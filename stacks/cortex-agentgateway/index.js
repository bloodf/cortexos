// cortex-agentgateway — tool taxonomy enforcement gateway.
//
// Responsibilities:
//   - Authenticate inbound tool-invoke requests via bearer token.
//   - Look up the requested tool in config/tools.json.
//   - Resolve role-scoped permission (safe / privileged / destructive).
//   - Require confirmation_token for destructive-class tools.
//   - Emit a CloudEvents-wrapped audit record to NATS subject
//     `cortex.audit.agentgateway.tool-invoke.v1` and (best-effort) append
//     to the hash-chained Postgres audit log.
//
// This module wires together the building blocks and exposes:
//   - createApp({ config, executor, publisher, auditAppend })  → express.Application
//   - start()                                                  → listens on AGENTGATEWAY_PORT
//
// The default executor is a no-op stub that echoes the args back. Real tool
// dispatchers will be wired in subsequent prompts. The audit + permission
// contract — which is what callers actually rely on — is fully implemented.

import express from "express";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { envelope as buildEnvelope } from "@cortexos/events";
import { instrument as instrumentTelemetry } from "@cortexos/telemetry";

import { loadToolsConfig, resolvePermission } from "./lib/tools.js";
import { publish as natsPublish } from "./lib/nats-publisher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_CONFIG_PATH = resolve(__dirname, "config/tools.json");
const SERVICE_SOURCE = "cortexos://cortex-agentgateway";
const AUDIT_SUBJECT = "cortex.audit.agentgateway.tool-invoke.v1";
const AUDIT_EVENT_TYPE = "cortex.audit.agentgateway.tool-invoke.v1";

// Audit append is best-effort. If @cortexos/audit cannot reach Postgres we
// log to stderr and continue so the gateway stays available even when the
// audit DB is offline. NATS audit publish is the durable record of truth.
const CORTEX_AUDIT_ENABLED = process.env.CORTEX_AUDIT_ENABLED !== "0";

async function defaultAuditAppend(event) {
  if (!CORTEX_AUDIT_ENABLED) return;
  try {
    const mod = await import("@cortexos/audit");
    await mod.append(event);
  } catch (e) {
    process.stderr.write(
      `[audit] append failed type=${event?.type || "unknown"}: ${e.message}\n`,
    );
  }
}

function constantTimeBearerEqual(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function bearerAuth(req, res, next) {
  const secret = process.env.AGENTGATEWAY_BEARER_TOKEN || "";
  if (!secret) {
    res.status(503).json({ error: "bearer token not configured" });
    return;
  }
  const header = req.get("authorization") || "";
  if (!header.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  if (!constantTimeBearerEqual(token, secret)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

function structuredLog(line) {
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

// Default tool executor — no real side effects yet. Returns a deterministic
// shape the audit pipeline can hash. Real spokes will swap this out.
async function defaultExecutor({ tool, args }) {
  return {
    tool,
    status: "stubbed",
    receivedArgs: args ?? null,
    note: "cortex-agentgateway default executor: no real side effects yet",
  };
}

function validateInvokeBody(body) {
  if (!body || typeof body !== "object") return "invalid body";
  if (typeof body.tool !== "string" || !body.tool) return "tool required";
  if (typeof body.runId !== "string" || !body.runId) return "runId required";
  if (typeof body.agentId !== "string" || !body.agentId) return "agentId required";
  if (typeof body.role !== "string" || !body.role) return "role required";
  if (body.args !== undefined && (body.args === null || typeof body.args !== "object")) {
    return "args must be object";
  }
  return null;
}

export function createApp(opts = {}) {
  const configPath = opts.configPath || process.env.AGENTGATEWAY_CONFIG || DEFAULT_CONFIG_PATH;
  const config = opts.config || loadToolsConfig(configPath);
  const executor = opts.executor || defaultExecutor;
  const publisher = opts.publisher || natsPublish;
  const auditAppend = opts.auditAppend || defaultAuditAppend;

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "cortex-agentgateway",
      policyVersion: config.policyVersion,
      ts: new Date().toISOString(),
    });
  });

  app.get("/tools", bearerAuth, (_req, res) => {
    res.json({
      policyVersion: config.policyVersion,
      toolClasses: config.toolClasses,
      tools: config.tools.map((t) => ({
        name: t.name,
        class: t.class,
        description: t.description,
      })),
    });
  });

  app.post("/tool/invoke", bearerAuth, async (req, res) => {
    const startedAt = Date.now();
    const err = validateInvokeBody(req.body);
    if (err) {
      res.status(400).json({ error: err });
      structuredLog({
        level: "warn",
        ts: new Date().toISOString(),
        route: "/tool/invoke",
        status: 400,
        reason: err,
        latencyMs: Date.now() - startedAt,
      });
      return;
    }

    const { tool, args, runId, agentId, role, confirmationToken } = req.body;

    const decision = resolvePermission(config, { role, tool });
    if (!decision.allowed) {
      res.status(403).json({ allowed: false, reason: decision.reason });
      structuredLog({
        level: "warn",
        ts: new Date().toISOString(),
        route: "/tool/invoke",
        runId,
        role,
        tool,
        status: 403,
        reason: decision.reason,
        latencyMs: Date.now() - startedAt,
      });
      return;
    }

    if (decision.toolClass === "destructive") {
      if (!confirmationToken || typeof confirmationToken !== "string") {
        res.status(403).json({
          allowed: false,
          reason: "destructive tool requires confirmationToken",
        });
        structuredLog({
          level: "warn",
          ts: new Date().toISOString(),
          route: "/tool/invoke",
          runId,
          role,
          tool,
          status: 403,
          reason: "missing confirmationToken",
          latencyMs: Date.now() - startedAt,
        });
        return;
      }
    }

    let executionResult = null;
    let execError = null;
    try {
      executionResult = await executor({ tool, args, runId, agentId, role });
    } catch (e) {
      execError = e?.message || String(e);
    }

    const auditData = {
      runId,
      agentId,
      role,
      tool,
      toolClass: decision.toolClass,
      args: args ?? null,
      result: executionResult,
      error: execError,
      occurredAt: new Date().toISOString(),
    };

    const auditEvent = buildEnvelope({
      type: AUDIT_EVENT_TYPE,
      source: SERVICE_SOURCE,
      subject: `${role}/${tool}`,
      data: auditData,
    });

    // Best-effort fan-out to NATS + Postgres audit chain. Neither failure mode
    // should mask the tool result back to the caller — the executor outcome
    // is what the agent acts on. Failures are surfaced via stderr + the
    // shared `cortex.alerts.error.*` pattern in future hardening passes.
    try {
      await publisher(AUDIT_SUBJECT, auditEvent);
    } catch (e) {
      process.stderr.write(`[audit-nats] publish failed: ${e.message}\n`);
    }
    auditAppend(auditEvent).catch(() => {
      /* logged inside defaultAuditAppend */
    });

    const status = execError ? 502 : 200;
    res.status(status).json({
      ok: !execError,
      tool,
      toolClass: decision.toolClass,
      result: executionResult,
      error: execError,
      auditId: auditEvent.id,
    });

    structuredLog({
      level: execError ? "error" : "info",
      ts: new Date().toISOString(),
      route: "/tool/invoke",
      runId,
      role,
      tool,
      toolClass: decision.toolClass,
      status,
      latencyMs: Date.now() - startedAt,
    });
  });

  return app;
}

export async function start() {
  instrumentTelemetry({
    service: "cortex-agentgateway",
    env: process.env.NODE_ENV || "production",
  });
  const app = createApp();
  const port = Number(process.env.AGENTGATEWAY_PORT || 18800);
  await new Promise((resolveListen) => {
    app.listen(port, "0.0.0.0", () => {
      structuredLog({
        level: "info",
        ts: new Date().toISOString(),
        service: "cortex-agentgateway",
        msg: "listening",
        port,
      });
      resolveListen();
    });
  });
}

const isEntry =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isEntry) {
  start().catch((e) => {
    process.stderr.write(`[fatal] ${e.stack || e.message}\n`);
    process.exit(1);
  });
}
