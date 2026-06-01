#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);
const DRY_RUN = process.env.CORTEX_DEGRADED_WATCHER_DRY_RUN === "1";
const DB_URL = process.env.DASHBOARD_DATABASE_URL || process.env.DATABASE_URL || null;
const SYSTEMD_NAME_RE = /^[A-Za-z0-9_.@:-]+\.service$/;
const SAFE_DOCKER_RE = /^[A-Za-z0-9_.-]+$/;
const SAFE_PROCESS_RE = /^[A-Za-z0-9_.:-]+$/;
const MAX_REPAIR_UNITS = Number(process.env.CORTEX_DEGRADED_WATCHER_MAX_REPAIR_UNITS || 8);
const AI_MODEL = process.env.CORTEX_DEGRADED_WATCHER_MODEL || process.env.NINEROUTER_DEFAULT_MODEL || "minimax/MiniMax-M2.7";

function log(obj) {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...obj })}\n`);
}
async function run(cmd, args, opts = {}) {
  try {
    const res = await execFileAsync(cmd, args, { timeout: opts.timeout ?? 15_000, maxBuffer: opts.maxBuffer ?? 1024 * 1024, env: process.env });
    return { ok: true, stdout: res.stdout ?? "", stderr: res.stderr ?? "", code: 0 };
  } catch (err) {
    return { ok: false, stdout: err.stdout ?? "", stderr: err.stderr ?? err.message ?? String(err), code: err.code ?? 1 };
  }
}
async function loadEnv(path) {
  const out = {};
  try {
    for (const line of (await readFile(path, "utf8")).split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {}
  return out;
}
async function dashboardDbUrl() {
  if (DB_URL) return DB_URL.replace(/^"|"$/g, "");
  const env = await loadEnv("/opt/cortexos/.secrets/dashboard.env");
  return env.DATABASE_URL || null;
}
async function dashboardServices() {
  const url = await dashboardDbUrl();
  if (!url) return [];
  const sql = "select coalesce(json_agg(json_build_object('slug',slug,'name',name,'kind',kind,'health_type',health_type,'health_url',health_url) order by slug),'[]'::json) from services where is_active = true and show_in_healthcheck = true";
  const res = await run("psql", [url, "-At", "-q", "-c", sql], { timeout: 10_000, maxBuffer: 2 * 1024 * 1024 });
  if (!res.ok) {
    log({ level: "warn", event: "dashboard_query_failed", error: res.stderr.slice(0, 500) });
    return [];
  }
  try { return JSON.parse(res.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) || "[]"); } catch { return []; }
}
async function systemdFailed() {
  const res = await run("systemctl", ["list-units", "--type=service", "--state=failed", "--no-legend", "--no-pager"], { timeout: 10_000 });
  if (!res.ok) return [];
  return res.stdout.split(/\r?\n/).map((line) => line.trim().split(/\s+/)[0]).filter((u) => SYSTEMD_NAME_RE.test(u));
}
async function isServiceOffline(svc) {
  if (svc.health_type === "systemd") {
    if (!SYSTEMD_NAME_RE.test(svc.health_url)) return { offline: true, reason: "invalid systemd unit" };
    const res = await run("systemctl", ["is-active", svc.health_url], { timeout: 5000 });
    return { offline: res.stdout.trim() !== "active", reason: res.stdout.trim() || res.stderr.trim() };
  }
  if (svc.health_type === "docker") {
    if (!SAFE_DOCKER_RE.test(svc.health_url)) return { offline: true, reason: "invalid docker pattern" };
    const res = await run("docker", ["ps", "--filter", `name=${svc.health_url}`, "--format", "{{.Status}}"], { timeout: 5000 });
    return { offline: !res.stdout.includes("Up"), reason: res.stdout.trim() || res.stderr.trim() || "not running" };
  }
  if (svc.health_type === "process") {
    if (!SAFE_PROCESS_RE.test(svc.health_url)) return { offline: true, reason: "invalid process pattern" };
    const res = await run("pgrep", ["-f", svc.health_url], { timeout: 3000 });
    return { offline: !res.ok, reason: res.ok ? "running" : "process not found" };
  }
  if (svc.health_type === "http") {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(svc.health_url, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(to);
      return { offline: !(res.ok || res.status === 401 || res.status === 403), reason: `http ${res.status}` };
    } catch (err) {
      return { offline: true, reason: err.message || String(err) };
    }
  }
  return { offline: false, reason: "unsupported" };
}
async function evidence(target) {
  const chunks = [];
  if (target.unit && SYSTEMD_NAME_RE.test(target.unit)) {
    chunks.push(`systemctl status ${target.unit}:\n${(await run("systemctl", ["status", target.unit, "--no-pager"], { timeout: 8000, maxBuffer: 512 * 1024 })).stdout}`);
    chunks.push(`journalctl ${target.unit}:\n${(await run("journalctl", ["-u", target.unit, "-n", "80", "--no-pager"], { timeout: 8000, maxBuffer: 512 * 1024 })).stdout}`);
  }
  if (target.docker && SAFE_DOCKER_RE.test(target.docker)) {
    chunks.push(`docker ps ${target.docker}:\n${(await run("docker", ["ps", "-a", "--filter", `name=${target.docker}`, "--format", "{{.Names}} {{.Status}}"], { timeout: 8000 })).stdout}`);
    chunks.push(`docker logs ${target.docker}:\n${(await run("docker", ["logs", "--tail", "80", target.docker], { timeout: 8000, maxBuffer: 512 * 1024 })).stderr}`);
  }
  return chunks.join("\n\n").slice(-12000);
}
async function askAi(target, data) {
  const env = { ...(await loadEnv("/opt/cortexos/.secrets/9router.env")), ...(await loadEnv("/opt/cortexos/.secrets/paperclip-app.env")), ...process.env };
  const base = (env.NINEROUTER_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
  const key = env.NINEROUTER_API_KEY || env.OPENAI_API_KEY || "";
  const prompt = `You are diagnosing a degraded CortexOS service. Return compact JSON only: {"cause":"...","safe_actions":["restart_systemd","restart_docker","reset_failed"],"notes":"..."}. Prefer safe restarts/reset-failed only. Target: ${JSON.stringify(target)}\nEvidence:\n${data}`;
  try {
    const res = await fetch(`${base.endsWith("/v1") ? base : `${base}/v1`}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.1, max_tokens: 500 }),
    });
    const json = await res.json();
    return json?.choices?.[0]?.message?.content || `AI request failed status=${res.status}`;
  } catch (err) {
    return `AI unavailable: ${err.message || String(err)}`;
  }
}
async function repair(target) {
  const actions = [];
  if (target.unit && SYSTEMD_NAME_RE.test(target.unit)) {
    if (!DRY_RUN) actions.push(await run("systemctl", ["reset-failed", target.unit], { timeout: 10_000 }));
    if (!DRY_RUN) actions.push(await run("systemctl", ["restart", target.unit], { timeout: 30_000 }));
    return actions;
  }
  if (target.docker && SAFE_DOCKER_RE.test(target.docker)) {
    if (!DRY_RUN) actions.push(await run("docker", ["restart", target.docker], { timeout: 30_000 }));
    return actions;
  }
  return actions;
}
async function main() {
  const targets = [];
  for (const unit of await systemdFailed()) targets.push({ source: "systemd_failed", unit, name: unit });
  for (const svc of await dashboardServices()) {
    const state = await isServiceOffline(svc);
    if (!state.offline) continue;
    targets.push({ source: "dashboard", name: svc.name, slug: svc.slug, unit: svc.health_type === "systemd" ? svc.health_url : null, docker: svc.health_type === "docker" ? svc.health_url : null, process: svc.health_type === "process" ? svc.health_url : null, reason: state.reason });
  }
  const unique = [];
  const seen = new Set();
  for (const t of targets) {
    const key = t.unit || t.docker || `${t.source}:${t.slug || t.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }
  log({ event: "scan", degraded: unique.length, dryRun: DRY_RUN });
  for (const target of unique.slice(0, MAX_REPAIR_UNITS)) {
    const data = await evidence(target);
    const ai = await askAi(target, data);
    log({ event: "diagnosis", target, ai });
    const actions = await repair(target);
    log({ event: "repair", target, actions: actions.map((a) => ({ ok: a.ok, code: a.code, stderr: a.stderr.slice(0, 300), stdout: a.stdout.slice(0, 300) })) });
  }
}

main().catch((err) => {
  log({ level: "error", event: "fatal", error: err.stack || err.message || String(err) });
  process.exit(1);
});
