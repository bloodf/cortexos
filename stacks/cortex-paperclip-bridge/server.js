import express from "express";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { recordLink } from "./lib/idempotency.js";
import { publish, getConnection } from "./lib/nats-publisher.js";
import { envelope, validate as validateCloudEvent } from "@cortexos/events";
import { instrument as instrumentTelemetry, shutdown as shutdownTelemetry } from "@cortexos/telemetry";
import { append as auditAppend } from "@cortexos/audit";

// V9 — hash-chained audit log. Same fire-and-forget contract as the
// consumer: failures emit `cortex.alerts.error.audit-append-failed` and
// the webhook still returns 202 so Paperclip doesn't retry the run.
const CORTEX_AUDIT_ENABLED = process.env.CORTEX_AUDIT_ENABLED !== "0";
async function safeAuditAppend(event) {
  if (!CORTEX_AUDIT_ENABLED) return;
  try { await auditAppend(event); }
  catch (e) {
    process.stderr.write(`[audit] append failed type=${event.event_type}: ${e.message}\n`);
    try {
      await publish("cortex.alerts.error.audit-append-failed", {
        event_type: event.event_type,
        source: event.source,
        subject: event.subject ?? null,
        reason: e.message,
        ts: new Date().toISOString(),
      });
    } catch { /* swallow */ }
  }
}

const PORT = Number(process.env.BRIDGE_PORT || 8089);
const HOST = process.env.BRIDGE_HOST || "127.0.0.1";
const FAMILY = process.env.CORTEX_OS_FAMILY || "unknown";
const START_TS = Date.now();

function constantTimeBearerEqual(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

export function bearerAuth(req, res, next) {
  const secret = process.env.PAPERCLIP_WEBHOOK_SECRET || "";
  if (!secret) {
    res.status(503).json({ error: "webhook secret not configured" });
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

function validate(body) {
  if (!body || typeof body !== "object") return "invalid body";
  if (typeof body.runId !== "string" || !body.runId) return "runId required";
  if (typeof body.agentId !== "string" || !body.agentId) return "agentId required";
  if (!body.context || typeof body.context !== "object") return "context required";
  const { taskId, wakeReason } = body.context;
  if (typeof taskId !== "string" || !taskId) return "context.taskId required";
  const allowed = ["scheduled", "comment", "new_issue", "manual", "issue_assigned"];
  if (!allowed.includes(wakeReason)) return "context.wakeReason invalid";
  if (typeof body.cortexRole !== "string" || !body.cortexRole) return "cortexRole required";
  return null;
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  app.get("/healthz", (_req, res) => {
    res.json({
      status: "ok",
      uptime: (Date.now() - START_TS) / 1000,
      family: FAMILY,
    });
  });

  app.post("/paperclip/heartbeat", bearerAuth, async (req, res) => {
    const error = validate(req.body);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const { runId, agentId, cortexRole, context } = req.body;
    const subject = `cortex.paperclip.work.${cortexRole}`;
    try {
      const originalWakeReason = context.wakeReason;
      const wakeReason = originalWakeReason === "issue_assigned" ? "new_issue" : originalWakeReason;
      const { inserted } = await recordLink({
        issueId: context.taskId,
        runId,
        agentId,
        role: cortexRole,
        subject,
      });
      const data = {
        runId,
        issueId: context.taskId,
        agentId,
        role: cortexRole,
        wakeReason,
        originalWakeReason,
        payload: req.body,
      };
      if (context.commentId) data.requestedBy = context.commentId;
      const event = envelope({
        type: `cortex.paperclip.work.${cortexRole}.v1`,
        source: "cortex-paperclip-bridge",
        subject: context.taskId,
        data,
      });
      // CloudEvents extension attribute (top-level) — preserves the legacy replay marker
      // without polluting the strict inner data schema.
      event.replay = !inserted;
      validateCloudEvent(event);
      await publish(subject, event);
      await safeAuditAppend({
        event_type: `cortex.paperclip.work.${cortexRole}.inbound`,
        source: "cortex-paperclip-bridge",
        subject: context.taskId,
        actor: agentId,
        event_id: event.id,
        payload: {
          runId,
          issueId: context.taskId,
          role: cortexRole,
          replay: !inserted,
          wakeReason,
          originalWakeReason,
        },
      });
      res.status(202).json({ runId, status: "queued" });
    } catch (e) {
      process.stderr.write(`[bridge] heartbeat failed run=${runId}: ${e.message}\n`);
      res.status(500).json({ error: "internal error" });
    }
  });

  return app;
}

async function main() {
  // V8 — OpenLLMetry + Langfuse bootstrap. Safe no-op when LANGFUSE_HOST is
  // unset; otherwise webhook ingest + downstream NATS publish are linked
  // into the same trace tree as the consumer/graph spans.
  const tel = instrumentTelemetry({ service: "cortex-paperclip-bridge" });
  if (tel.enabled) {
    process.stdout.write(`[telemetry] enabled service=${tel.service} env=${tel.env}\n`);
  }

  const app = createApp();
  try { await getConnection(); } catch (e) {
    process.stderr.write(`[bridge] NATS preconnect failed (will retry on publish): ${e.message}\n`);
  }
  const server = app.listen(PORT, HOST, () => {
    process.stdout.write(`[bridge] listening ${HOST}:${PORT} family=${FAMILY}\n`);
  });
  const shutdown = (sig) => {
    process.stdout.write(`[bridge] ${sig} — closing\n`);
    server.close(async () => {
      try { await shutdownTelemetry(); } catch {}
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

const invokedDirectly = process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href;
if (invokedDirectly) {
  main().catch((e) => {
    process.stderr.write(`[bridge] fatal: ${e.stack || e.message}\n`);
    process.exit(1);
  });
}
