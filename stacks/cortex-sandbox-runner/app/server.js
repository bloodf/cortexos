// server.js — Express front-end to the gVisor-backed runner.
//
// Endpoints
//   GET  /healthz         — liveness probe (cheap, no podman touch)
//   GET  /metrics         — prom-text counters
//   POST /exec            — bearer-authed, schema-validated, spawns
//                           `podman --runtime=runsc run --rm ...`
//                           and returns the captured stdio.
//
// The spawn function is injected so unit tests can supply a fake
// process without needing a real podman + runsc on the CI runner.

import express from "express";
import { spawn as defaultSpawn } from "node:child_process";
import { ExecRequestSchema, decide, buildPodmanArgs } from "./policy.js";

const PORT = Number(process.env.PORT || 8091);
const API_TOKEN = process.env.CORTEX_SANDBOX_API_TOKEN || "";
const PODMAN_BIN = process.env.CORTEX_SANDBOX_PODMAN_BIN || "podman";

const metrics = {
  exec_total: 0,
  exec_ok_total: 0,
  exec_fail_total: 0,
  exec_rejected_policy_total: 0,
  exec_rejected_auth_total: 0,
  exec_timeout_total: 0,
};

/**
 * Run a podman command and capture stdio with a hard wall-clock
 * timeout. Returns `{ exitCode, stdout, stderr, stats }`. The
 * spawn implementation is injectable for tests.
 */
export async function runExec(plan, opts = {}) {
  const spawn = opts.spawn || defaultSpawn;
  const { bin, args } = buildPodmanArgs(plan, { podmanBin: opts.podmanBin || PODMAN_BIN });
  const startedAt = Date.now();
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill("SIGKILL"); } catch { /* already dead */ }
    }, plan.timeoutSec * 1000);

    child.stdout.on("data", (b) => { stdout += b.toString("utf8"); });
    child.stderr.on("data", (b) => { stderr += b.toString("utf8"); });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode: -1,
        stdout,
        stderr: stderr + `\n[runner] spawn error: ${err.message}`,
        stats: { durationMs: Date.now() - startedAt, timedOut: false, spawnError: true },
      });
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode: typeof code === "number" ? code : (signal ? 137 : -1),
        stdout,
        stderr,
        stats: { durationMs: Date.now() - startedAt, timedOut, signal: signal || null },
      });
    });

    if (plan.stdin) {
      try { child.stdin.write(plan.stdin); } catch { /* swallow */ }
    }
    try { child.stdin.end(); } catch { /* swallow */ }
  });
}

/**
 * Build the Express app. Exported so tests can drive it without a
 * real listening socket and so the spawn target is injectable.
 */
export function buildApp(opts = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  const requireAuth = (req, res, next) => {
    if (!API_TOKEN) {
      // Fail closed in production. In test mode (NODE_ENV=test) callers
      // may pass `opts.skipAuth=true` to drive the handler directly.
      if (opts.skipAuth) return next();
      metrics.exec_rejected_auth_total++;
      return res.status(503).json({ error: "sandbox_token_unset" });
    }
    const hdr = req.get("authorization") || "";
    const match = hdr.match(/^Bearer\s+(.+)$/i);
    if (!match || match[1] !== API_TOKEN) {
      metrics.exec_rejected_auth_total++;
      return res.status(401).json({ error: "unauthorized" });
    }
    return next();
  };

  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

  app.get("/metrics", (_req, res) => {
    const lines = [];
    for (const [k, v] of Object.entries(metrics)) {
      lines.push(`# TYPE sandbox_${k} counter`);
      lines.push(`sandbox_${k} ${v}`);
    }
    res.set("Content-Type", "text/plain; version=0.0.4").send(lines.join("\n") + "\n");
  });

  app.post("/exec", requireAuth, async (req, res) => {
    metrics.exec_total++;
    const parsed = ExecRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      metrics.exec_rejected_policy_total++;
      return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    }
    const decision = decide(parsed.data, opts.policyOpts);
    if (!decision.ok) {
      metrics.exec_rejected_policy_total++;
      return res.status(400).json({ error: "policy_rejected", reason: decision.reason });
    }
    try {
      const result = await runExec(decision.plan, { spawn: opts.spawn, podmanBin: opts.podmanBin });
      if (result.stats?.timedOut) metrics.exec_timeout_total++;
      if (result.exitCode === 0) metrics.exec_ok_total++;
      else metrics.exec_fail_total++;
      return res.status(200).json(result);
    } catch (e) {
      metrics.exec_fail_total++;
      return res.status(500).json({ error: "runner_error", reason: e.message });
    }
  });

  return app;
}

// Export metrics view for tests.
export function _snapshotMetrics() { return { ...metrics }; }

// Boot only when run directly, not when imported by tests.
const isDirect = import.meta.url === `file://${process.argv[1]}`;
if (isDirect) {
  const app = buildApp();
  app.listen(PORT, "0.0.0.0", () => {
    process.stdout.write(`[sandbox] listening on :${PORT}\n`);
  });
}
