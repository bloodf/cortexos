#!/usr/bin/env node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const runId = `smoke-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const role = `ENG-SMOKE-${runId.toUpperCase().replace(/[^A-Z0-9]/g, "-")}`;
const factorySlug = `tmp-${runId}`;
const honchoWorkspace = `tmp-${runId}`;
const honchoSession = "full-pipeline";
const honchoPeer = "tmp-smoke-peer";
const paperclipBase = normalizeApiBase(process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3034/api");
const paperclipKey = process.env.PAPERCLIP_API_KEY || "";
const companyId = process.env.PAPERCLIP_COMPANY_ID || "";
const honchoBase = (process.env.HONCHO_BASE_URL || "http://127.0.0.1:18690").replace(/\/$/, "");
const honchoKey = process.env.HONCHO_API_KEY || "";
const smokeHermesProfile = resolveSmokeHermesProfile();

const state = {
  tmpDir: "",
  agentId: "",
  issueId: "",
  runId: "",
};

function normalizeApiBase(url) {
  const trimmed = url.replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function log(check, data = {}) {
  console.log(JSON.stringify({ ok: true, check, ...data }));
}

function assertEnv(name, value) {
  if (!value) throw new Error(`${name} is required`);
}

function resolveSmokeHermesProfile() {
  if (process.env.CORTEX_SMOKE_HERMES_PROFILE) return process.env.CORTEX_SMOKE_HERMES_PROFILE;
  try {
    const registryPath = process.env.HERMES_PROFILES_REGISTRY || "/opt/cortexos/hermes/profiles.json";
    const registry = JSON.parse(readFileSync(registryPath, "utf8"));
    const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];
    return profiles[0]?.profile || "primary";
  } catch {
    return "primary";
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      authorization: `Bearer ${paperclipKey}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${url} returned HTTP ${res.status}: ${text}`);
  }
  return body;
}

async function honchoPost(path, body) {
  const res = await fetch(`${honchoBase}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${honchoKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok && res.status !== 409) {
    throw new Error(`Honcho ${path} returned HTTP ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

function shell(command, options = {}) {
  return execFileSync("bash", ["-lc", command], {
    cwd: root,
    encoding: "utf8",
    stdio: options.stdio || ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ROLE: role,
      FACTORY_SLUG: factorySlug,
      HONCHO_WORKSPACE: honchoWorkspace,
      HONCHO_SESSION: honchoSession,
      HONCHO_PEER: honchoPeer,
      MARKER: options.marker || "",
    },
  });
}

function dashboardDatabaseUrl() {
  const raw = readFileSync("/opt/cortexos/.secrets/dashboard.env", "utf8");
  const match = raw.match(/^DATABASE_URL=(.+)$/m);
  if (!match) throw new Error("DATABASE_URL missing from /opt/cortexos/.secrets/dashboard.env");
  return match[1].trim().replace(/^"|"$/g, "");
}

function sqlQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function upsertFactory() {
  const definition = JSON.stringify({
    source: "cortex-full-pipeline-smoke",
    role,
    paperclip: {
      adapterType: "hermes_local",
      hermesProfile: smokeHermesProfile,
      honchoWorkspace,
    },
    pipeline: ["factory", "paperclip", "hermes", "honcho"],
  });
  execFileSync("psql", [
    dashboardDatabaseUrl(),
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `insert into agent_factories (slug, name, kind, schema_version, definition, created_by) values (${sqlQuote(factorySlug)}, 'Temporary full pipeline smoke', 'pipeline', 1, ${sqlQuote(definition)}::jsonb, 'smoke') on conflict (slug) do update set definition = excluded.definition, updated_at = now();`,
  ], {
    input: "",
    env: {
      ...process.env,
      PGOPTIONS: `--search_path=public`,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
}

function deleteFactory() {
  try {
    execFileSync("psql", [
      dashboardDatabaseUrl(),
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `delete from agent_factories where slug = '${factorySlug}';`,
    ], { stdio: ["ignore", "ignore", "pipe"] });
  } catch {}
}

async function registerTempAgent() {
  state.tmpDir = await mkdtemp(join(tmpdir(), "cortex-full-smoke-"));
  const rolesDir = join(state.tmpDir, "roles");
  await shell(`mkdir -p ${JSON.stringify(rolesDir)}`);
  const roleFile = join(rolesDir, `${role}.md`);
  await writeFile(roleFile, `---
paperclip:
  title:            "Temporary Full Pipeline Smoke"
  role:             "${role}"
  boss:             "CTO"
  monthlyBudgetUsd: 1
  adapterType:      "hermes_local"
  adapterPath:      "/paperclip/heartbeat"
  routine:          "0 */15 * * * *"
---

# Temporary Full Pipeline Smoke

This role is created only by scripts/cortex-full-pipeline-smoke.mjs and must be removed after the run.
`, "utf8");

  const keysFile = join(state.tmpDir, "paperclip-keys.json");
  shell(`set -a; source /opt/cortexos/.secrets/paperclip.env; source /opt/cortexos/.secrets/9router.env; source /opt/cortexos/.secrets/honcho.env; export ROLES_DIR=${JSON.stringify(rolesDir)}; export PAPERCLIP_KEYS_FILE=${JSON.stringify(keysFile)}; export HERMES_COMMAND=/opt/cortexos/bin/hermes-paperclip; export HERMES_PROFILE_MAP='{"${role}":${JSON.stringify(smokeHermesProfile)}}'; set +a; pnpm dlx tsx scripts/paperclip-register-roles.ts`, { stdio: "pipe" });
  const keys = JSON.parse(await readFile(keysFile, "utf8"));
  state.agentId = keys.keys?.[0]?.agentId || "";
  if (!state.agentId) throw new Error("temporary Paperclip agent was not registered");
  log("paperclip-agent-registered", { agentId: state.agentId, role });
}

async function createAssignedIssue() {
  const issue = await fetchJson(`${paperclipBase}/companies/${encodeURIComponent(companyId)}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title: `Full pipeline smoke ${runId}`,
      description: [
        "This is an automated CortexOS smoke issue.",
        "Do not edit repository files.",
        "Use curl to mark this issue done and add a short comment that says full-pipeline-smoke-ok.",
      ].join("\n"),
      priority: "low",
      assigneeAgentId: state.agentId,
    }),
  });
  state.issueId = issue.id;
  log("paperclip-issue-created", { issueId: state.issueId, identifier: issue.identifier });
}

async function invokeAndWait() {
  const run = await fetchJson(`${paperclipBase}/agents/${encodeURIComponent(state.agentId)}/heartbeat/invoke?companyId=${encodeURIComponent(companyId)}`, {
    method: "POST",
    body: "{}",
  });
  state.runId = run.id;
  log("paperclip-heartbeat-invoked", { runId: state.runId });
  for (let i = 0; i < 240; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const current = await fetchJson(`${paperclipBase}/heartbeat-runs/${encodeURIComponent(state.runId)}`);
    if (["succeeded", "failed", "cancelled", "timed_out"].includes(current.status)) {
      if (current.status !== "succeeded") {
        throw new Error(`temporary Hermes run ended with ${current.status}: ${current.error || current.resultJson?.summary || ""}`);
      }
      log("hermes-run-succeeded", { runId: state.runId, sessionId: current.resultJson?.session_id || null });
      return;
    }
  }
  throw new Error(`temporary Hermes run did not finish: ${state.runId}`);
}

async function verifyIssueCompleted() {
  const issue = await fetchJson(`${paperclipBase}/issues/${encodeURIComponent(state.issueId)}`);
  if (issue.status !== "done") {
    throw new Error(`temporary issue was not marked done; status=${issue.status}`);
  }
  const comments = await fetchJson(`${paperclipBase}/issues/${encodeURIComponent(state.issueId)}/comments`);
  const commentList = Array.isArray(comments) ? comments : comments.comments || [];
  const hasMarker = commentList.some((comment) => String(comment.body || "").includes("full-pipeline-smoke-ok"));
  if (!hasMarker) throw new Error("temporary issue did not receive the expected smoke comment");
  log("paperclip-issue-completed", { issueId: state.issueId });
}

async function verifyHonchoEmbeddings() {
  const marker = `full-pipeline-honcho-${runId}`;
  await honchoPost("/v3/workspaces", { id: honchoWorkspace });
  await honchoPost(`/v3/workspaces/${encodeURIComponent(honchoWorkspace)}/peers`, { id: honchoPeer });
  await honchoPost(`/v3/workspaces/${encodeURIComponent(honchoWorkspace)}/sessions`, { id: honchoSession });
  await honchoPost(
    `/v3/workspaces/${encodeURIComponent(honchoWorkspace)}/sessions/${encodeURIComponent(honchoSession)}/messages`,
    {
      messages: [
        {
          peer_id: honchoPeer,
          content: `${marker} confirms Honcho embeddings through Vulkan Ollama`,
          metadata: { source: "cortex-full-pipeline-smoke" },
        },
      ],
    },
  );
  for (let i = 0; i < 30; i += 1) {
    const out = shell(`docker exec honcho-database psql -U postgres -d postgres -tAc "select coalesce(max(vector_dims(embedding)), 0) from message_embeddings where content like '%${marker}%';"`);
    const dims = Number(out.trim());
    if (dims === 768) {
      log("honcho-ollama-embedding", { workspace: honchoWorkspace, dims });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Honcho did not create a 768-dimension Ollama embedding for the smoke message");
}

async function cleanup() {
  if (state.issueId) {
    try {
      await fetchJson(`${paperclipBase}/issues/${encodeURIComponent(state.issueId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled", comment: "Cleaning up temporary full pipeline smoke issue." }),
      });
    } catch {}
    try {
      await fetchJson(`${paperclipBase}/issues/${encodeURIComponent(state.issueId)}`, { method: "DELETE" });
    } catch {}
  }
  if (state.agentId) {
    try {
      await fetchJson(`${paperclipBase}/agents/${encodeURIComponent(state.agentId)}/terminate`, { method: "POST", body: "{}" });
    } catch {}
    try {
      await fetchJson(`${paperclipBase}/agents/${encodeURIComponent(state.agentId)}`, { method: "DELETE" });
    } catch {}
  }
  deleteFactory();
  if (state.tmpDir) await rm(state.tmpDir, { recursive: true, force: true });
}

async function main() {
  assertEnv("PAPERCLIP_API_KEY", paperclipKey);
  assertEnv("PAPERCLIP_COMPANY_ID", companyId);
  assertEnv("HONCHO_API_KEY", honchoKey);
  upsertFactory();
  log("factory-pipeline-upserted", { slug: factorySlug });
  await registerTempAgent();
  await createAssignedIssue();
  await invokeAndWait();
  await verifyIssueCompleted();
  await verifyHonchoEmbeddings();
  log("full-pipeline-smoke-complete", { role, factorySlug });
}

main()
  .catch(async (error) => {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(cleanup);
