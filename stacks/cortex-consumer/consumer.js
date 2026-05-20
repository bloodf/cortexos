#!/usr/bin/env node
// cortex-consumer v1.0 — JetStream durable subs, OpenClaw HTTP API, rich blocks, circuit breaker

// ---------------------------------------------------------------------------
// nats.js upstream bug workaround: internal timers may pass values > 2^31-1
// ms to setTimeout, triggering "TimeoutOverflowWarning" flood that crashes
// the process via systemd watchdog. Cap all timeouts at INT32_MAX before
// delegating to native setTimeout. Safe: any real timer < 24.8 days stays
// unchanged; pathological values get clamped to 24.8 days instead of 1ms.
// ---------------------------------------------------------------------------
const __INT32_MAX = 2_147_483_647;
const __origSetTimeout = global.setTimeout;
global.setTimeout = function patchedSetTimeout(handler, timeout, ...args) {
  if (typeof timeout === "number" && Number.isFinite(timeout) && timeout > __INT32_MAX) {
    timeout = __INT32_MAX;
  }
  return __origSetTimeout(handler, timeout, ...args);
};
global.setTimeout.__patched = true;

import { connect, StringCodec, AckPolicy, DeliverPolicy, RetentionPolicy, StorageType, headers as natsHeaders, nanos } from "nats";
import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { envelope as buildCloudEvent, validate as validateCloudEvent, EnvelopeValidationError } from "@cortexos/events";
import { instrument as instrumentTelemetry, traceLLMCall, shutdown as shutdownTelemetry } from "@cortexos/telemetry";
import { append as auditAppend } from "@cortexos/audit";
import { publishToDlq } from "./lib/dlq.js";
import { awaitSignal as awaitNatsSignal } from "./lib/signals.js";
import { recordPending as recordPendingApproval, resolvePending as resolvePendingApproval } from "./lib/pending-approvals.js";

// V9 — hash-chained audit log. Failures here MUST NOT block production
// transitions; they raise `cortex.alerts.error.audit-append-failed` and
// the original op continues. See docs/AUDIT.md for the trade-off rationale.
const CORTEX_AUDIT_ENABLED = process.env.CORTEX_AUDIT_ENABLED !== "0";

async function safeAuditAppend(event) {
  if (!CORTEX_AUDIT_ENABLED) return;
  try {
    await auditAppend(event);
  } catch (e) {
    process.stderr.write(`[audit] append failed type=${event.event_type}: ${e.message}\n`);
    try {
      // Wrapped via the shared CloudEvents publisher; `publishEnvelope` is
      // hoisted (declared as a function above) so this reference resolves
      // at call time even though it appears earlier in source order.
      publishEnvelope(
        "cortex.alerts.error.audit-append-failed",
        "cortex.alerts.error.audit-append-failed.v1",
        {
          event_type: event.event_type,
          source: event.source,
          subject: event.subject ?? null,
          reason: e.message,
          ts: new Date().toISOString(),
        },
      );
    } catch { /* publish failures already logged elsewhere */ }
  }
}
const execFileP = promisify(execFile);

const CORTEX_REQUIRE_ENVELOPE = process.env.CORTEX_REQUIRE_ENVELOPE === "1";

// V7 — optional dispatch through the cortex-graph LangGraph sidecar. When
// `CORTEX_GRAPH_URL` is set AND the role's frontmatter advertises
// `graphEnabled: true`, paperclip work is POST'd to the sidecar in addition
// to the existing accept/in_progress emit path. The sidecar owns resumable
// state via Postgres checkpoints; failure to reach it must not block the
// legacy path so a misconfigured sidecar cannot stall the consumer.
const CORTEX_GRAPH_URL = (process.env.CORTEX_GRAPH_URL || "").replace(/\/$/, "");
const CORTEX_GRAPH_API_TOKEN = process.env.CORTEX_GRAPH_API_TOKEN || "";
const CORTEX_GRAPH_ROLES_FILE = process.env.CORTEX_GRAPH_ROLES_FILE
  || "/opt/cortexos/templates/agent-roles/.graph-enabled.json";

// V10 — optional dispatch through the cortex-sandbox-runner service.
// When `CORTEX_SANDBOX_URL` is set AND the role's frontmatter advertises
// `sandboxRequired: true`, tool exec is routed to the runner instead of
// inline shell. Failures are logged and do not block the accept path so
// a misconfigured runner cannot stall the consumer.
const CORTEX_SANDBOX_URL = (process.env.CORTEX_SANDBOX_URL || "").replace(/\/$/, "");
const CORTEX_SANDBOX_API_TOKEN = process.env.CORTEX_SANDBOX_API_TOKEN || "";
const CORTEX_SANDBOX_ROLES_FILE = process.env.CORTEX_SANDBOX_ROLES_FILE
  || "/opt/cortexos/templates/agent-roles/.sandbox-required.json";

// V13 — optional dispatch through the cortex-agentgateway tool broker.
// When `AGENTGATEWAY_BASE_URL` is set AND the role appears in the
// agentgateway roster AND the inbound paperclip payload contains a
// `tool_invocation` block, the consumer POSTs to `/tool/invoke` for
// permission gating + audit fan-out. Missing bearer downgrades to a
// fail-safe skip (logged once) so a half-configured gateway cannot
// stall the consumer.
const AGENTGATEWAY_BASE_URL = (process.env.AGENTGATEWAY_BASE_URL || "http://127.0.0.1:18800").replace(/\/$/, "");
const AGENTGATEWAY_BEARER_TOKEN = process.env.AGENTGATEWAY_BEARER_TOKEN || "";
const AGENTGATEWAY_ROLES_FILE = process.env.AGENTGATEWAY_ROLES_FILE
  || "/opt/cortexos/templates/agent-roles/.agentgateway-required.json";

// V12 — NATS-signal approvals. When a role appears in the approval-required
// roster file the consumer pauses dispatch and awaits a signed signal at
// `cortex.signals.<runId>.approval`. Timeout defaults to 24h and is
// overridable per-deploy via PAPERCLIP_APPROVAL_TIMEOUT_SEC. Misconfig
// (missing roster) falls through to the non-gated path — the gate is a
// safety net, not the only authorization mechanism.
const PAPERCLIP_APPROVAL_TIMEOUT_SEC = Math.max(
  1,
  Number(process.env.PAPERCLIP_APPROVAL_TIMEOUT_SEC || 86_400),
);
const CORTEX_APPROVAL_ROLES_FILE = process.env.CORTEX_APPROVAL_ROLES_FILE
  || "/opt/cortexos/templates/agent-roles/.approval-required.json";

// ---------------------------------------------------------------------------
// Config + env
// ---------------------------------------------------------------------------
const NATS_URL = process.env.NATS_URL || "nats://127.0.0.1:4222";
const OPENCLAW_BASE = (process.env.OPENCLAW_BASE_URL || "http://127.0.0.1:18789").replace(/\/$/, "");
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || "openclaw";
const OPENCLAW_CLI_TIMEOUT_MS = Number(process.env.OPENCLAW_CLI_TIMEOUT_MS || 15_000);
const OPENCLAW_OUTBOUND_HMAC = process.env.CORTEX_OPENCLAW_OUTBOUND_HMAC || "";
// Delivery API selector. "cli" (default) shells out to `openclaw message send`,
// which is the verified real-OpenClaw delivery path (gateway is ws://, not REST).
// "v1" routes through `${OPENCLAW_BASE}/v1/channels/<channel>/messages`.
// The legacy `/sendMessage` shape (404 on OpenClaw ≥2026.5.12) has been removed.
const OPENCLAW_DELIVERY_API_VERSION = (process.env.OPENCLAW_DELIVERY_API_VERSION || "cli").toLowerCase();
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY || "";
const NATS_HMAC = process.env.CORTEX_NATS_HMAC || "";
const ROUTING_CONFIG = process.env.ROUTING_CONFIG || "/opt/cortexos/stacks/cortex-consumer/config.json";
const STATE_FILE = process.env.THREAD_STATE_FILE || "/opt/cortexos/state/consumer-threads.json";
const HEALTH_HOST = process.env.HEALTH_HOST || "127.0.0.1";
const HEALTH_PORT = Number(process.env.HEALTH_PORT || 7080);
const METRICS_HOST = process.env.METRICS_HOST || "127.0.0.1";
const METRICS_PORT = Number(process.env.METRICS_PORT || 7081);
const STREAM = process.env.CORTEX_STREAM || "CORTEX";
const DRY_RUN = process.env.DRY_RUN === "1";

// Consumer durables — one per subject filter
const DURABLES = {
  factoryCreated: process.env.DURABLE_FACTORY_CREATED || "cortex-consumer-factory-created",
  factoryWorkflow: process.env.DURABLE_FACTORY_WORKFLOW || "cortex-consumer-factory-workflow",
  openclawReceived: process.env.DURABLE_OPENCLAW_RECEIVED || "cortex-consumer-openclaw-received",
  paperclipWork: process.env.DURABLE_PAPERCLIP_WORK || "cortex-consumer-paperclip-work",
};

const STREAM_NAMES = {
  FACTORY: "cortex_factory",
  APPROVAL: "cortex_approval",
  ALERT: "cortex_alert",
  HEALTH: "cortex_health",
  DLQ: "cortex_consumer_errors",
};

const KV_BUCKET = "cortex_approvals_seen";
const KV_TTL_MS = 10 * 60 * 1000; // 10 min in milliseconds

// ---------------------------------------------------------------------------
// Ajv schema validation (loaded lazily)
// ---------------------------------------------------------------------------
let ajvInstance = null;
async function getAjv() {
  if (ajvInstance !== null) return ajvInstance;
  try {
    const { default: AjvClass } = await import("ajv");
    ajvInstance = new AjvClass({ strict: false });
  } catch {
    process.stderr.write("[schema] ajv not available; skipping validation\n");
    ajvInstance = false;
  }
  return ajvInstance;
}

const schemaCache = new Map();

/**
 * Schema name resolution.
 *
 * Two roots:
 *   - NATS event envelopes:    templates/nats/schemas/<name>.json
 *   - Canonical block payload: templates/messages/schema.json
 *
 * The special name "messages.blocks" maps to templates/messages/schema.json so
 * consumer.js can dual-validate cortex.factory.workflow.* events: envelope
 * against cortex.factory.workflow.json, and the inner `blocks` payload against
 * the canonical block schema referenced in plan §4f.
 *
 * Override roots via CORTEX_TEMPLATES_DIR for testing.
 */
function resolveSchemaCandidates(name) {
  const templatesDirEnv = process.env.CORTEX_TEMPLATES_DIR;
  if (name === "messages.blocks") {
    const candidates = [];
    if (templatesDirEnv) candidates.push(`${templatesDirEnv}/messages/schema.json`);
    candidates.push(
      "/opt/cortexos/templates/messages/schema.json",
      new URL("../../templates/messages/schema.json", import.meta.url).pathname,
    );
    return candidates;
  }
  const candidates = [];
  if (templatesDirEnv) candidates.push(`${templatesDirEnv}/nats/schemas/${name}.json`);
  candidates.push(
    `/opt/cortexos/templates/nats/schemas/${name}.json`,
    new URL(`../../templates/nats/schemas/${name}.json`, import.meta.url).pathname,
  );
  return candidates;
}

export function loadSchema(name) {
  if (schemaCache.has(name)) return schemaCache.get(name);
  for (const p of resolveSchemaCandidates(name)) {
    try {
      const s = JSON.parse(readFileSync(p, "utf8"));
      schemaCache.set(name, s);
      return s;
    } catch { /* try next */ }
  }
  return null;
}

export async function validatePayload(schemaName, payload) {
  const ajv = await getAjv();
  const strict = process.env.STRICT_VALIDATION === "1";
  if (!ajv) {
    if (strict) throw new Error(`[schema] ajv unavailable but STRICT_VALIDATION=1 (schema=${schemaName})`);
    return true;
  }
  const schema = loadSchema(schemaName);
  if (!schema) {
    if (strict) throw new Error(`[schema] missing schema file: ${schemaName} (STRICT_VALIDATION=1)`);
    return true;
  }
  const validate = ajv.compile(schema);
  if (!validate(payload)) {
    process.stderr.write(`[schema] ${schemaName} invalid: ${JSON.stringify(validate.errors)}\n`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const sc = StringCodec();
const THREAD_TS = new Map();
/** @type {import("nats").NatsConnection | null} */
let nc = null;
/** @type {import("nats").JetStreamClient | null} */
let js = null;
/** @type {import("nats").KV | null} */
let kvBucket = null;
let shuttingDown = false;
let lastMessageAt = 0;
let lastError = "";

// ---------------------------------------------------------------------------
// Metrics counters
// ---------------------------------------------------------------------------
const metrics = {
  messages_received_total: 0,
  messages_acked_total: 0,
  messages_nacked_total: 0,
  messages_dlq_total: 0,
  openclaw_http_errors_total: 0,
  openclaw_http_ok_total: 0,
  hmac_reject_total: 0,
  nonce_replay_total: 0,
  approval_stall_total: 0,
  circuit_open_total: 0,
};

// ---------------------------------------------------------------------------
// Circuit breaker (inline — no external lib)
// ---------------------------------------------------------------------------
const CB_THRESHOLD = 5;
const CB_WINDOW_MS = 30_000;
const CB_OPEN_MS = 60_000;

const cb = {
  state: "closed",   // "closed" | "open" | "half-open"
  failures: [],      // timestamps of recent failures
  openAt: 0,
  probeInFlight: false,
};

function cbRecord(success) {
  const now = Date.now();
  if (success) {
    cb.state = "closed";
    cb.failures = [];
    cb.probeInFlight = false;
    return;
  }
  cb.failures.push(now);
  cb.failures = cb.failures.filter(t => now - t < CB_WINDOW_MS);
  if (cb.failures.length >= CB_THRESHOLD && cb.state === "closed") {
    cb.state = "open";
    cb.openAt = now;
    metrics.circuit_open_total++;
    process.stderr.write("[circuit] OPEN — OpenClaw HTTP suspended for 60s\n");
  }
}

function cbAllow() {
  const now = Date.now();
  if (cb.state === "closed") return true;
  if (cb.state === "open") {
    if (now - cb.openAt >= CB_OPEN_MS) {
      cb.state = "half-open";
      process.stdout.write("[circuit] HALF-OPEN — probe attempt\n");
    } else {
      return false;
    }
  }
  // half-open: allow one probe at a time
  if (cb.probeInFlight) return false;
  cb.probeInFlight = true;
  return true;
}

// ---------------------------------------------------------------------------
// OpenClaw CLI helpers (gateway uses ws://, not HTTP REST — shell to CLI)
// ---------------------------------------------------------------------------
async function openclawExec(args) {
  if (!cbAllow()) throw new Error(`circuit open — skipping openclaw ${args[0]}`);
  // V8 — wrap the OpenClaw dispatch in a Langfuse generation span so
  // operator visibility extends from NATS receipt through the downstream
  // LLM-driven channel send. The wrapper is a no-op when LANGFUSE_HOST is
  // unset, preserving the existing dev/test behaviour.
  return traceLLMCall(
    {
      name: `openclaw.${args[0] || "cmd"}`,
      model: "openclaw-cli",
      input: { args },
      metadata: { component: "cortex-consumer" },
      tags: ["openclaw", "dispatch"],
    },
    async () => {
      try {
        const { stdout } = await execFileP(OPENCLAW_BIN, args, {
          timeout: OPENCLAW_CLI_TIMEOUT_MS,
          maxBuffer: 4 * 1024 * 1024,
        });
        metrics.openclaw_http_ok_total++;
        cbRecord(true);
        return stdout;
      } catch (e) {
        metrics.openclaw_http_errors_total++;
        cbRecord(false);
        throw new Error(`openclaw ${args.join(" ")} failed: ${e.message || e}`);
      }
    },
  );
}

function renderBlocksToText(blocks) {
  if (!blocks) return "";
  const lines = [];
  const h = blocks.header;
  if (h) lines.push(`${h.emoji || ""} ${h.title || ""}${h.subtitle ? ` — ${h.subtitle}` : ""}`.trim());
  for (const s of blocks.sections || []) {
    if (s.type === "kv") for (const [k, v] of s.items || []) lines.push(`${k}: ${v}`);
    else if (s.type === "text") lines.push(s.markdown || "");
    else if (s.type === "code") lines.push("```" + (s.lang || "") + "\n" + (s.body || "") + "\n```");
  }
  return lines.join("\n").trim();
}

async function openclawSendMessage({ account, channel, target, blocks }) {
  if (OPENCLAW_DELIVERY_API_VERSION === "v1") {
    return openclawSendMessageHttpV1({ account, channel, target, blocks });
  }
  // Default: CLI shellout — verified real OpenClaw delivery path.
  const args = ["message", "send", "--json"];
  if (account) args.push("--account", account);
  if (channel) args.push("--channel", channel);
  if (target) args.push("--target", String(target));
  args.push("-m", renderBlocksToText(blocks) || " ");
  args.push("--presentation", JSON.stringify(blocks || {}));
  return openclawExec(args);
}

// HTTP REST delivery (opt-in via OPENCLAW_DELIVERY_API_VERSION=v1).
// Endpoint shape: POST ${OPENCLAW_BASE}/v1/channels/<channel>/messages
// Auth: Bearer ${OPENCLAW_API_KEY}.
async function openclawSendMessageHttpV1({ account, channel, target, blocks }) {
  if (!cbAllow()) throw new Error("circuit open — skipping openclaw http v1");
  if (!channel) throw new Error("openclaw http v1 requires channel id");
  const url = `${OPENCLAW_BASE}/v1/channels/${encodeURIComponent(channel)}/messages`;
  const body = {
    account: account || undefined,
    target: target ? String(target) : undefined,
    text: renderBlocksToText(blocks) || " ",
    presentation: blocks || {},
  };
  const headers = { "content-type": "application/json" };
  if (OPENCLAW_API_KEY) headers.authorization = `Bearer ${OPENCLAW_API_KEY}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    process.stdout.write(`[openclaw.http] ${res.status} ${url}\n`);
    if (!res.ok) {
      metrics.openclaw_http_errors_total++;
      cbRecord(false);
      const text = await res.text().catch(() => "");
      throw new Error(`openclaw http v1 ${res.status}: ${text.slice(0, 200)}`);
    }
    metrics.openclaw_http_ok_total++;
    cbRecord(true);
    return await res.text();
  } catch (e) {
    metrics.openclaw_http_errors_total++;
    cbRecord(false);
    throw new Error(`openclaw http v1 failed: ${e.message || e}`);
  }
}

async function openclawBindRoute({ agent, channel, account }) {
  const args = ["agents", "bind", "--agent", agent];
  if (channel) args.push("--bind", account ? `${channel}:${account}` : channel);
  return openclawExec(args);
}

function normalizeRole(role) {
  return String(role || "").trim().toUpperCase();
}

function paperclipProjectSlug(data) {
  const payload = data?.payload || {};
  const context = payload.context || {};
  return String(
    context.projectSlug
      || context.project_slug
      || payload.projectSlug
      || payload.project_slug
      || data?.projectSlug
      || "",
  ).trim().toLowerCase();
}

function resolvePaperclipAgent(role, data, cfg) {
  const map = cfg?.paperclip?.agent_map || {};
  const project = paperclipProjectSlug(data);
  const normalizedRole = normalizeRole(role);
  const candidates = [];
  if (project && map[project]) candidates.push(map[project]);
  if (map.default) candidates.push(map.default);
  for (const entry of candidates) {
    if (!entry || typeof entry !== "object") continue;
    const direct = entry[normalizedRole] || entry[String(role || "")] || entry.default;
    if (direct) return String(direct);
  }
  return null;
}

function buildPaperclipAgentPrompt(role, data) {
  const payload = data?.payload || {};
  const context = payload.context || {};
  return [
    `Paperclip assigned work to CortexOS role ${role}.`,
    "",
    `Run ID: ${data?.runId || "unknown"}`,
    `Issue/Task ID: ${data?.issueId || context.taskId || "unknown"}`,
    `Wake reason: ${data?.wakeReason || context.wakeReason || "manual"}`,
    "",
    "Use your configured workspace, restored memory, and workflow files.",
    "Complete the next safe step for this task, then return a concise status summary.",
    "Do not print secrets or credentials.",
    "",
    "Paperclip payload:",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  ].join("\n");
}

function summarizeOpenClawOutput(stdout) {
  const raw = String(stdout || "").trim();
  if (!raw) throw new Error("OpenClaw returned no output");
  if (/Cannot read properties of null|uncaught|traceback|error:/i.test(raw)) {
    throw new Error(raw.slice(0, 500));
  }
  try {
    const parsed = JSON.parse(raw);
    const payloads = parsed?.result?.payloads;
    if (Array.isArray(payloads)) {
      const text = payloads
        .map((payload) => payload?.text)
        .filter((value) => typeof value === "string" && value.trim())
        .join("\n")
        .trim();
      if (/Cannot read properties of null|uncaught|traceback|error:/i.test(text)) {
        throw new Error(text.slice(0, 500));
      }
      if (text) return text;
    }
    const finalText = parsed?.result?.meta?.finalAssistantVisibleText
      || parsed?.result?.meta?.finalAssistantRawText
      || parsed?.finalAssistantVisibleText
      || parsed?.finalAssistantRawText
      || parsed?.summary;
    if (typeof finalText === "string" && finalText.trim()) return finalText.trim();
    throw new Error("OpenClaw JSON output did not include assistant text");
  } catch (error) {
    if (error instanceof SyntaxError) return raw;
    throw error;
  }
}

async function dispatchPaperclipOpenClawAgent(role, data, cfg) {
  const agentId = resolvePaperclipAgent(role, data, cfg);
  if (!agentId) return null;
  const timeoutSec = Number(process.env.PAPERCLIP_OPENCLAW_TIMEOUT_SEC || 900);
  const stdout = await openclawExec([
    "agent",
    "--agent",
    agentId,
    "--message",
    buildPaperclipAgentPrompt(role, data),
    "--json",
    "--timeout",
    String(timeoutSec),
  ]);
  return { agentId, stdout, summary: summarizeOpenClawOutput(stdout) };
}

// ---------------------------------------------------------------------------
// HMAC + JCS
// ---------------------------------------------------------------------------

/** RFC8785-style canonical JSON (stable key order) */
function jcs(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${jcs(value[k])}`).join(",")}}`;
}

function hmacSha256(secret, payload) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyOpenclawHmac(envelopeRaw, signature) {
  if (!OPENCLAW_OUTBOUND_HMAC) {
    process.stderr.write("[hmac] CORTEX_OPENCLAW_OUTBOUND_HMAC not set — rejecting all inbound\n");
    return false;
  }
  return hmacSha256(OPENCLAW_OUTBOUND_HMAC, envelopeRaw) === signature;
}

function verifyNatsApprovalHmac(payload) {
  if (!NATS_HMAC) {
    process.stderr.write("[hmac] CORTEX_NATS_HMAC not set — rejecting approval\n");
    return false;
  }
  const { hmac: sig, ...rest } = payload;
  if (!sig) return false;
  return hmacSha256(NATS_HMAC, jcs(rest)) === sig;
}

// ---------------------------------------------------------------------------
// Replay-nonce KV
// ---------------------------------------------------------------------------
async function checkAndRecordNonce(nonce) {
  if (!kvBucket) return true; // degraded — allow
  try {
    await kvBucket.create(nonce, sc.encode("1"));
    return true;
  } catch (e) {
    // create() throws on duplicate key
    metrics.nonce_replay_total++;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Stalled approval tracker
// ---------------------------------------------------------------------------
const pendingApprovals = new Map();

function trackApproval(approvalId, stage, timeoutMs) {
  clearApprovalTimer(approvalId);
  const t = setTimeout(async () => {
    metrics.approval_stall_total++;
    process.stderr.write(`[approval] stalled: ${approvalId} stage=${stage}\n`);
    pendingApprovals.delete(approvalId);
    try {
      await publishAlert("approval-stalled", { approval_id: approvalId, stage, ts: new Date().toISOString() });
    } catch (e) {
      process.stderr.write(`[approval] stall alert failed: ${e.message}\n`);
    }
  }, timeoutMs);
  pendingApprovals.set(approvalId, { stage, ts: Date.now(), timeout: t });
}

function clearApprovalTimer(approvalId) {
  const entry = pendingApprovals.get(approvalId);
  if (entry?.timeout) clearTimeout(entry.timeout);
  pendingApprovals.delete(approvalId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadJson(filePath, fallback) {
  try { return JSON.parse(readFileSync(filePath, "utf8")); }
  catch { return fallback; }
}

function loadConfig() {
  return loadJson(ROUTING_CONFIG, {
    routes: {},
    approval_timeout_minutes: 30,
    openclaw: { account_ref: "cortex" },
  });
}

function loadThreadState() {
  const state = loadJson(STATE_FILE, {});
  for (const [k, v] of Object.entries(state)) {
    if (typeof v === "string") THREAD_TS.set(k, v);
  }
}

function saveThreadState() {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(Object.fromEntries(THREAD_TS), null, 2));
  renameSync(tmp, STATE_FILE);
}

// ---------------------------------------------------------------------------
// NATS publish helpers
// ---------------------------------------------------------------------------
/**
 * Extract CloudEvents id from a payload shape. The bridge wraps work events
 * as `{ data: <CE>, sig }`; status events follow the same shape. Bare
 * CloudEvents objects expose `.id` directly. Returns null if no id found.
 */
function extractCloudEventId(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.id === "string" && payload.specversion === "1.0") return payload.id;
  if (payload.data && typeof payload.data === "object" && typeof payload.data.id === "string" && payload.data.specversion === "1.0") {
    return payload.data.id;
  }
  return null;
}

function buildPublishOpts(payload) {
  const id = extractCloudEventId(payload);
  if (!id) return undefined;
  const h = natsHeaders();
  h.set("Nats-Msg-Id", id);
  return { headers: h };
}

function publish(subject, payload) {
  if (!nc || nc.isClosed()) return;
  // Best-effort dedup header. Core publish accepts headers via nc.publish opts.
  const opts = buildPublishOpts(payload);
  if (opts) {
    nc.publish(subject, sc.encode(JSON.stringify(payload)), opts);
  } else {
    nc.publish(subject, sc.encode(JSON.stringify(payload)));
  }
}

/**
 * Shared helper: wrap `data` in a CloudEvents 1.0 envelope, validate it,
 * HMAC-sign with CORTEX_NATS_HMAC (when present), and publish on `subject`
 * with `Nats-Msg-Id = <CloudEvent.id>` for JetStream dedup.
 *
 * Returns the published CloudEvent id (or null when NATS is down/HMAC unset
 * under strict mode). Failure modes are non-fatal: validation issues are
 * logged and propagate only when CORTEX_REQUIRE_ENVELOPE=1.
 */
function publishEnvelope(subject, type, data, opts = {}) {
  if (!nc || nc.isClosed()) return null;
  let ce;
  try {
    ce = buildCloudEvent({
      type,
      source: opts.source || "cortex-consumer",
      subject: opts.subject,
      data,
    });
    validateCloudEvent(ce);
  } catch (e) {
    process.stderr.write(`[publish] cloudevents build/validate failed type=${type}: ${e.message}\n`);
    if (CORTEX_REQUIRE_ENVELOPE) {
      if (e instanceof EnvelopeValidationError) throw e;
      return null;
    }
  }
  if (!ce) return null;
  // Per docs/NATS-CONTRACT.md the wire shape is `{ data: <CE>, sig }` so
  // the publish() helper's CE-id extraction stamps Nats-Msg-Id correctly.
  if (!NATS_HMAC) {
    process.stderr.write(`[publish] CORTEX_NATS_HMAC unset — emitting unsigned envelope on ${subject}\n`);
    publish(subject, { data: ce });
    return ce?.id || null;
  }
  const sig = hmacSha256(NATS_HMAC, jcs(ce));
  publish(subject, { data: ce, sig });
  return ce?.id || null;
}

async function publishAlert(kind, data) {
  // Subject migrated: cortex.alert.<kind> → cortex.alerts.<kind> (canonical
  // plural per docs/NATS-CONTRACT.md and schemas/cortex-alerts-v1.json).
  publishEnvelope(
    `cortex.alerts.${kind}`,
    `cortex.alerts.${kind}.v1`,
    { kind, ts: new Date().toISOString(), ...data },
  );
}

async function publishDLQ(subject, data, reason) {
  metrics.messages_dlq_total++;
  // Best-effort fallback DLQ record on the legacy core subject. The
  // JetStream DLQ path in processMessage() uses publishToDlq() and the
  // documented `cortex.dlq.<original>` namespace.
  publishEnvelope(
    "cortex.dlq.cortex.consumer.errors",
    "cortex.dlq.errors.v1",
    {
      originalSubject: subject,
      reason,
      ts: new Date().toISOString(),
      payload: data,
    },
  );
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleFactoryCreated(data) {
  await validatePayload("cortex.factory.created", data);
  const { factory_slug, account_ref, channels = [] } = data;
  if (!factory_slug) throw new Error("factory_slug missing");
  if (DRY_RUN) {
    process.stdout.write(`[dry-run] registerRoute factory_slug=${factory_slug}\n`);
    return;
  }
  const accountRef = account_ref || "cortex";
  let bound = 0;
  for (const ch of channels) {
    const channelName = typeof ch === "string" ? ch : ch?.channel;
    const channelAccount = typeof ch === "string" ? accountRef : (ch?.account || accountRef);
    if (!channelName) continue;
    try {
      await openclawBindRoute({ agent: factory_slug, channel: channelName, account: channelAccount });
      bound++;
    } catch (e) {
      process.stderr.write(`[factory.created] bind failed ${factory_slug}/${channelName}: ${e.message}\n`);
    }
  }
  process.stdout.write(`[factory.created] bound ${bound}/${channels.length} routes for ${factory_slug}\n`);
}

async function handleFactoryWorkflow(subject, data, cfg) {
  // Envelope validation (subject schema).
  await validatePayload("cortex.factory.workflow", data);
  const parts = subject.split(".");
  const slug = parts[3] || "unknown";
  const stage = parts[4] || "unknown";
  const accountRef = data.account_ref || cfg.openclaw?.account_ref || "cortex";
  const threadKey = data.thread_key || `factory:${slug}`;
  const approvalId = data.approval_id;
  const approvalTimeoutMs = (cfg.approval_timeout_minutes || 30) * 2 * 60 * 1000;

  // Canonical block payload validation (templates/messages/schema.json).
  // Plan §4f: dual-validate envelope + inner blocks. Under STRICT_VALIDATION=1
  // a malformed blocks payload is DLQ'd and the throw propagates so the poll
  // loop records the failure; otherwise we warn and still publish so a single
  // bad sender cannot stop the whole stream.
  const strict = process.env.STRICT_VALIDATION === "1";
  const blocks = data.blocks || buildDefaultBlocks(slug, stage, data);
  const blocksOk = await validatePayload("messages.blocks", blocks);
  if (!blocksOk) {
    if (strict) {
      await publishDLQ(subject, data, "blocks_schema_invalid");
      throw new Error(`[schema] blocks invalid for ${subject} (STRICT_VALIDATION=1)`);
    }
    process.stderr.write(`[schema] blocks invalid for ${subject} — publishing anyway (non-strict)\n`);
  }

  if (DRY_RUN) {
    process.stdout.write(`[dry-run] sendMessage slug=${slug} stage=${stage}\n`);
    return;
  }

  // Channel list resolution: data.channels > cfg.routes[slug].channels > [{account: accountRef}]
  const route = cfg.routes?.[slug];
  const channels = data.channels || route?.channels || [{ account: accountRef, target: data.target }];
  let sent = 0;
  for (const ch of channels) {
    const account = ch.account || accountRef;
    const channel = ch.channel; // optional — CLI infers from account if omitted
    const target = ch.target || data.target;
    try {
      await openclawSendMessage({ account, channel, target, blocks });
      sent++;
    } catch (e) {
      process.stderr.write(`[factory.workflow] send failed ${slug}/${stage} ${account}/${channel || "?"}: ${e.message}\n`);
    }
  }

  if (approvalId) trackApproval(approvalId, stage, approvalTimeoutMs);
  process.stdout.write(`[factory.workflow] ${slug}/${stage} → sent ${sent}/${channels.length}\n`);
}

function buildDefaultBlocks(slug, stage, data) {
  const emoji = stage.includes("failed") ? "❌" : stage.includes("passed") ? "✅" : "⚙️";
  return {
    schema_version: 1,
    header: { emoji, title: `Factory: ${slug}`, subtitle: `stage: ${stage}` },
    sections: [
      {
        type: "kv",
        items: [
          ["Slug", slug],
          ["Stage", stage],
          ["Time", data.ts || new Date().toISOString()],
        ],
      },
    ],
    context: { factory_slug: slug, stage, ts: data.ts || new Date().toISOString() },
  };
}

// V7 — Graph dispatch helpers. Kept inline (no separate module) to avoid
// reshaping the test surface; existing consumer tests don't import these
// symbols and remain green when `CORTEX_GRAPH_URL` is unset.

let __graphRolesCache = null;

function loadGraphEnabledRoles() {
  if (__graphRolesCache !== null) return __graphRolesCache;
  try {
    const raw = JSON.parse(readFileSync(CORTEX_GRAPH_ROLES_FILE, "utf8"));
    __graphRolesCache = Array.isArray(raw)
      ? new Set(raw.map((r) => String(r).toUpperCase()))
      : new Set();
  } catch {
    __graphRolesCache = new Set();
  }
  return __graphRolesCache;
}

function shouldDispatchToGraph(role) {
  if (!CORTEX_GRAPH_URL) return false;
  if (!CORTEX_GRAPH_API_TOKEN) {
    process.stderr.write("[graph] CORTEX_GRAPH_URL set but CORTEX_GRAPH_API_TOKEN missing — skipping graph dispatch\n");
    return false;
  }
  const roles = loadGraphEnabledRoles();
  if (roles.size === 0) return false;
  return roles.has(String(role).toUpperCase());
}

async function dispatchToGraph({ role, issueId, runId, payload }) {
  // CloudEvents envelope mirroring `publishPaperclipStatus`. The sidecar
  // verifies the inner CE shape but the HTTP path uses bearer auth only —
  // HMAC envelope is reserved for the NATS bridge.
  const ce = buildCloudEvent({
    type: `cortex.graph.invoke.${role}.v1`,
    source: "cortex-consumer",
    subject: issueId,
    data: { role, issueId, runId, input: payload || {} },
  });
  try {
    validateCloudEvent(ce);
  } catch (e) {
    process.stderr.write(`[graph] cloudevents build invalid: ${e.message}\n`);
    if (CORTEX_REQUIRE_ENVELOPE) throw e;
  }
  const url = `${CORTEX_GRAPH_URL}/graph/runs`;
  const body = JSON.stringify({ role, issueId, input: payload || {} });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CORTEX_GRAPH_API_TOKEN}`,
        "X-Cortex-CloudEvent-Id": ce.id,
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`graph http ${res.status}: ${await res.text().catch(() => "")}`);
    }
    return await res.json().catch(() => ({}));
  } finally {
    clearTimeout(timeout);
  }
}

// V10 — Sandbox dispatch helpers. Parallel to the V7 graph helpers
// above. The roster file caches the same way; `__sandboxRolesCache`
// is reset implicitly with the consumer's lifetime.
let __sandboxRolesCache = null;

function loadSandboxRequiredRoles() {
  if (__sandboxRolesCache !== null) return __sandboxRolesCache;
  try {
    const raw = JSON.parse(readFileSync(CORTEX_SANDBOX_ROLES_FILE, "utf8"));
    __sandboxRolesCache = Array.isArray(raw)
      ? new Set(raw.map((r) => String(r).toUpperCase()))
      : new Set();
  } catch {
    __sandboxRolesCache = new Set();
  }
  return __sandboxRolesCache;
}

function shouldDispatchToSandbox(role) {
  if (!CORTEX_SANDBOX_URL) return false;
  if (!CORTEX_SANDBOX_API_TOKEN) {
    process.stderr.write("[sandbox] CORTEX_SANDBOX_URL set but CORTEX_SANDBOX_API_TOKEN missing — skipping sandbox dispatch\n");
    return false;
  }
  const roles = loadSandboxRequiredRoles();
  if (roles.size === 0) return false;
  return roles.has(String(role).toUpperCase());
}

async function dispatchToSandbox({ role, issueId, runId, payload }) {
  // Translate the paperclip payload into a sandbox /exec request. We
  // intentionally keep the field surface minimal here — the runner
  // re-validates everything via its zod schema and rejects unknown
  // images / network modes. When the payload lacks an explicit
  // `tool` block we fall back to a noop probe so dispatch wiring can
  // be exercised end-to-end before tool semantics ship.
  const tool = (payload && payload.tool) || {};
  const body = {
    image: tool.image || "alpine:3",
    cmd: Array.isArray(tool.cmd) && tool.cmd.length ? tool.cmd : ["true"],
    env: tool.env || {},
    timeoutSec: tool.timeoutSec,
    cpuMillis: tool.cpuMillis,
    memMB: tool.memMB,
    networkMode: tool.networkMode || "none",
    role,
  };
  const url = `${CORTEX_SANDBOX_URL}/exec`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CORTEX_SANDBOX_API_TOKEN}`,
        "X-Cortex-Run-Id": runId || "",
        "X-Cortex-Issue-Id": issueId || "",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`sandbox http ${res.status}: ${await res.text().catch(() => "")}`);
    }
    return await res.json().catch(() => ({}));
  } finally {
    clearTimeout(timeout);
  }
}

// V13 — AgentGateway dispatch helpers. Parallel to V7 (graph) and V10
// (sandbox). The roster gates which roles must route tool calls through
// the broker so permission gating + audit fan-out happens server-side.
let __agentGatewayRolesCache = null;
let __agentGatewayWarnedNoToken = false;

function loadAgentGatewayRoster() {
  if (__agentGatewayRolesCache !== null) return __agentGatewayRolesCache;
  try {
    const raw = JSON.parse(readFileSync(AGENTGATEWAY_ROLES_FILE, "utf8"));
    __agentGatewayRolesCache = Array.isArray(raw)
      ? new Set(raw.map((r) => String(r).toUpperCase()))
      : new Set();
  } catch {
    __agentGatewayRolesCache = new Set();
  }
  return __agentGatewayRolesCache;
}

function shouldDispatchToAgentGateway(role) {
  if (!AGENTGATEWAY_BASE_URL) return false;
  const roles = loadAgentGatewayRoster();
  if (roles.size === 0) return false;
  if (!AGENTGATEWAY_BEARER_TOKEN) {
    if (!__agentGatewayWarnedNoToken) {
      process.stderr.write("[agentgateway] roster non-empty but AGENTGATEWAY_BEARER_TOKEN missing — skipping dispatch\n");
      __agentGatewayWarnedNoToken = true;
    }
    return false;
  }
  return roles.has(String(role).toUpperCase());
}

// Extract the tool_invocation block from the paperclip payload. The bridge
// places it at `payload.tool_invocation`; legacy emitters may inline at the
// root. Either shape returns `{ tool, args, confirmationToken? }` or null.
function extractToolInvocation(payload) {
  if (!payload || typeof payload !== "object") return null;
  const inv = payload.tool_invocation || payload.toolInvocation || null;
  if (!inv || typeof inv !== "object" || !inv.tool) return null;
  return {
    tool: String(inv.tool),
    args: inv.args && typeof inv.args === "object" ? inv.args : {},
    confirmationToken: inv.confirmationToken || inv.confirmation_token || undefined,
  };
}

export async function dispatchToAgentGateway({ role, issueId, runId, agentId, invocation }) {
  const url = `${AGENTGATEWAY_BASE_URL}/tool/invoke`;
  const body = {
    tool: invocation.tool,
    args: invocation.args,
    runId,
    agentId: agentId || role,
    role,
  };
  if (invocation.confirmationToken) body.confirmationToken = invocation.confirmationToken;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AGENTGATEWAY_BEARER_TOKEN}`,
        "X-Cortex-Run-Id": runId || "",
        "X-Cortex-Issue-Id": issueId || "",
        "Nats-Msg-Id": runId ? `${runId}:${invocation.tool}` : "",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const status = res.status;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`agentgateway http ${status}: ${text}`);
      err.status = status;
      throw err;
    }
    return await res.json().catch(() => ({}));
  } finally {
    clearTimeout(timeout);
  }
}

// V12 — approval-required roster loader. Mirrors the V7/V10 cache pattern so
// the file is parsed once per process lifetime; restart picks up edits.
let __approvalRolesCache = null;

function loadApprovalRequiredRoles() {
  if (__approvalRolesCache !== null) return __approvalRolesCache;
  try {
    const raw = JSON.parse(readFileSync(CORTEX_APPROVAL_ROLES_FILE, "utf8"));
    __approvalRolesCache = Array.isArray(raw)
      ? new Set(raw.map((r) => String(r).toUpperCase()))
      : new Set();
  } catch {
    __approvalRolesCache = new Set();
  }
  return __approvalRolesCache;
}

export function isApprovalRequired(role) {
  const roles = loadApprovalRequiredRoles();
  return roles.has(String(role).toUpperCase());
}

async function handlePaperclipWork(subject, envelope, cfg = {}) {
  // Envelope shape: { data: <payload>, sig: <hex> }. Verify HMAC like approval path.
  if (!envelope || typeof envelope !== "object" || !envelope.data || !envelope.sig) {
    metrics.hmac_reject_total++;
    throw new Error("paperclip envelope missing data/sig");
  }
  const expected = hmacSha256(NATS_HMAC, jcs(envelope.data));
  if (!NATS_HMAC || expected !== envelope.sig) {
    metrics.hmac_reject_total++;
    throw new Error("paperclip envelope HMAC invalid");
  }
  // envelope.data is either a CloudEvents v1.0 object (v2) or legacy raw payload (v1).
  const inner = envelope.data;
  let data;
  if (inner && typeof inner === "object" && inner.specversion === "1.0" && inner.type) {
    try {
      validateCloudEvent(inner);
    } catch (e) {
      if (CORTEX_REQUIRE_ENVELOPE) {
        const detail = e instanceof EnvelopeValidationError ? JSON.stringify(e.errors) : e.message;
        throw new Error(`cloudevents_invalid: ${detail}`);
      }
      process.stderr.write(`[paperclip.work] cloudevents validation warning: ${e.message}\n`);
    }
    data = inner.data;
  } else {
    if (CORTEX_REQUIRE_ENVELOPE) throw new Error("cloudevents_required");
    process.stderr.write("[paperclip.work] legacy non-cloudevents payload accepted (CORTEX_REQUIRE_ENVELOPE=0)\n");
    data = inner;
  }
  const parts = subject.split(".");
  const role = parts[3] || data.role || "unknown";
  if (DRY_RUN) {
    process.stdout.write(`[paperclip.work] dry-run run=${data.runId} role=${role}\n`);
    return;
  }

  // V12 — NATS-signal approval gate. Destructive ops (roles flagged
  // `approvalRequired: true` in the roster file) MUST be unblocked by a
  // signed `cortex.signals.<runId>.approval` message before dispatch
  // proceeds. Timeout publishes `cortex.alerts.warning.approval-timeout`
  // and the run is abandoned; the JetStream message remains acked so the
  // run does not redeliver indefinitely. Operators rerun via Paperclip
  // if a timed-out run still needs to ship.
  if (isApprovalRequired(role) && data.runId) {
    const timeoutSec = Number(data.approvalTimeoutSec) > 0
      ? Number(data.approvalTimeoutSec)
      : PAPERCLIP_APPROVAL_TIMEOUT_SEC;
    try {
      await recordPendingApproval({
        runId: data.runId,
        signalName: "approval",
        role,
        issueId: data.issueId,
        reason: data.approvalReason || null,
        timeoutSec,
      });
    } catch (e) {
      process.stderr.write(`[approval] record pending failed run=${data.runId}: ${e.message}\n`);
    }
    process.stdout.write(`[approval] awaiting signal run=${data.runId} role=${role} timeoutSec=${timeoutSec}\n`);
    let decision;
    try {
      decision = await awaitNatsSignal({
        nc,
        runId: data.runId,
        signalName: "approval",
        timeoutSec,
      });
    } catch (e) {
      try {
        await resolvePendingApproval({
          runId: data.runId,
          signalName: "approval",
          decision: "timeout",
          approver: "system",
        });
      } catch { /* best-effort */ }
      await safeAuditAppend({
        event_type: `cortex.paperclip.work.${role}.approval-timeout`,
        source: "cortex-consumer",
        subject: data.issueId,
        actor: role,
        payload: { runId: data.runId, issueId: data.issueId, role, reason: e.message },
      });
      process.stderr.write(`[approval] timeout run=${data.runId} role=${role}: ${e.message}\n`);
      return;
    }
    const approver = decision?.approver || "unknown";
    const verdict = decision?.decision === "approve" ? "approve" : "deny";
    try {
      await resolvePendingApproval({
        runId: data.runId,
        signalName: "approval",
        decision: verdict,
        approver,
      });
    } catch { /* best-effort */ }
    await safeAuditAppend({
      event_type: `cortex.paperclip.work.${role}.approval-${verdict}`,
      source: "cortex-consumer",
      subject: data.issueId,
      actor: approver,
      payload: {
        runId: data.runId,
        issueId: data.issueId,
        role,
        decision: verdict,
        reason: decision?.reason || null,
      },
    });
    if (verdict !== "approve") {
      process.stdout.write(`[approval] denied run=${data.runId} role=${role} approver=${approver}\n`);
      publishPaperclipStatus(role, {
        runId: data.runId,
        issueId: data.issueId,
        status: "cancelled",
        comment: `Approval denied by ${approver}`,
        costUsdCents: 0,
      });
      return;
    }
    process.stdout.write(`[approval] approved run=${data.runId} role=${role} approver=${approver}\n`);
  }

  // V7 — gated dispatch to the cortex-graph sidecar. Only fires when:
  //   - CORTEX_GRAPH_URL + CORTEX_GRAPH_API_TOKEN are configured, AND
  //   - the role appears in the graph-enabled roster file.
  // Failures are logged but do not block the legacy accept/in_progress
  // emit path — V7 ships behind a feature flag.
  if (shouldDispatchToGraph(role)) {
    try {
      const resp = await dispatchToGraph({ role, issueId: data.issueId, runId: data.runId, payload: data.payload });
      process.stdout.write(`[graph] dispatched run=${data.runId} role=${role} thread=${resp.threadId || "?"}\n`);
    } catch (e) {
      process.stderr.write(`[graph] dispatch failed run=${data.runId} role=${role}: ${e.message}\n`);
    }
  }
  // V10 — gated dispatch to the cortex-sandbox-runner. Same envelope
  // as V7: opt-in via env + roster file. Falls through to the legacy
  // path on misconfiguration so the consumer cannot stall.
  if (shouldDispatchToSandbox(role)) {
    try {
      const resp = await dispatchToSandbox({ role, issueId: data.issueId, runId: data.runId, payload: data.payload });
      process.stdout.write(`[sandbox] dispatched run=${data.runId} role=${role} exit=${resp.exitCode ?? "?"}\n`);
    } catch (e) {
      process.stderr.write(`[sandbox] dispatch failed run=${data.runId} role=${role}: ${e.message}\n`);
    }
  }
  // V13 — gated dispatch to the cortex-agentgateway tool broker. Fires
  // when (1) role is in the agentgateway roster, AND (2) the payload
  // carries a `tool_invocation` block. AgentGateway owns the permission
  // gate (safe vs destructive), confirmation-token verification, and
  // CloudEvents audit publish on `cortex.audit.agentgateway.tool-invoke.v1`.
  // 401 → alert + DLQ-fallback. 403 → DLQ-fallback (caller denied).
  // 5xx → log only; the broker retries internally and JetStream
  // redelivery already covers the work message.
  const invocation = extractToolInvocation(data.payload);
  if (invocation && shouldDispatchToAgentGateway(role)) {
    try {
      const resp = await dispatchToAgentGateway({
        role,
        issueId: data.issueId,
        runId: data.runId,
        agentId: data.agentId,
        invocation,
      });
      process.stdout.write(`[agentgateway] dispatched run=${data.runId} role=${role} tool=${invocation.tool} result=${resp.status || "ok"}\n`);
    } catch (e) {
      process.stderr.write(`[agentgateway] dispatch failed run=${data.runId} role=${role} tool=${invocation.tool}: ${e.message}\n`);
      const status = e.status || 0;
      if (status === 401) {
        try { await publishAlert("error", { kind: "agentgateway-auth-failed", runId: data.runId, role, tool: invocation.tool }); } catch { /* best-effort */ }
        try { await publishDLQ(subject, data, `agentgateway 401: ${e.message}`); } catch { /* best-effort */ }
      } else if (status === 403) {
        try { await publishDLQ(subject, data, `agentgateway 403: ${e.message}`); } catch { /* best-effort */ }
      }
      // 5xx and network errors: rely on existing JetStream redelivery; do not DLQ here.
    }
  }
  // P2 scope: re-emit a `received` event for downstream OMC executor wiring.
  // Terminal-state publication (cortex.paperclip.status.<role>) happens once
  // the executor pipeline reports done|failed|cancelled. Until P3, we emit a
  // best-effort `accepted` status so end-to-end pipes are testable.
  // Subject migrated: cortex.paperclip.accepted.<role> →
  // cortex.paperclip.status.accepted.<role> (sub-namespace under the
  // documented cortex.paperclip.status.> umbrella).
  publishEnvelope(
    `cortex.paperclip.status.accepted.${role}`,
    `cortex.paperclip.status.accepted.${role}.v1`,
    {
      runId: data.runId,
      issueId: data.issueId,
      role,
      status: "accepted",
      ts: new Date().toISOString(),
    },
    { subject: data.issueId },
  );
  publishPaperclipStatus(role, {
    runId: data.runId,
    issueId: data.issueId,
    status: "in_progress",
    comment: "CortexOS picked up the run",
    costUsdCents: 0,
  });
  await safeAuditAppend({
    event_type: `cortex.paperclip.work.${role}.accepted`,
    source: "cortex-consumer",
    subject: data.issueId,
    actor: data.agentId || role,
    payload: {
      runId: data.runId,
      issueId: data.issueId,
      role,
      transition: "accepted",
    },
  });
  process.stdout.write(`[paperclip.work] run=${data.runId} role=${role} accepted\n`);

  const mappedAgent = resolvePaperclipAgent(role, data, cfg);
  if (!mappedAgent) return;
  try {
    const result = await dispatchPaperclipOpenClawAgent(role, data, cfg);
    publishPaperclipStatus(role, {
      runId: data.runId,
      issueId: data.issueId,
      status: "done",
      comment: `CortexOS agent ${result.agentId} completed the run: ${result.summary.slice(0, 500)}`,
      costUsdCents: 0,
    });
    await safeAuditAppend({
      event_type: `cortex.paperclip.work.${role}.completed`,
      source: "cortex-consumer",
      subject: data.issueId,
      actor: result.agentId,
      payload: {
        runId: data.runId,
        issueId: data.issueId,
        role,
        agentId: result.agentId,
      },
    });
  } catch (e) {
    process.stderr.write(`[paperclip.work] agent dispatch failed run=${data.runId} role=${role} agent=${mappedAgent}: ${e.message}\n`);
    publishPaperclipStatus(role, {
      runId: data.runId,
      issueId: data.issueId,
      status: "failed",
      comment: `CortexOS agent ${mappedAgent} failed: ${e.message}`,
      costUsdCents: 0,
    });
    throw e;
  }
}

function publishPaperclipStatus(role, payload) {
  if (!NATS_HMAC) {
    process.stderr.write("[paperclip.status] CORTEX_NATS_HMAC missing — skipping signed publish\n");
    return;
  }
  const ce = buildCloudEvent({
    type: `cortex.paperclip.status.${role}.v1`,
    source: "cortex-consumer",
    subject: payload.issueId,
    data: payload,
  });
  try {
    validateCloudEvent(ce);
  } catch (e) {
    process.stderr.write(`[paperclip.status] cloudevents build invalid: ${e.message}\n`);
    if (CORTEX_REQUIRE_ENVELOPE) return;
  }
  const sig = hmacSha256(NATS_HMAC, jcs(ce));
  publish(`cortex.paperclip.status.${role}`, { data: ce, sig });
  // Fire-and-forget hash-chain append for the status transition.
  safeAuditAppend({
    event_type: `cortex.paperclip.status.${role}`,
    source: "cortex-consumer",
    subject: payload.issueId,
    actor: role,
    event_id: ce.id,
    payload: {
      runId: payload.runId,
      issueId: payload.issueId,
      status: payload.status,
      comment: payload.comment ?? null,
      costUsdCents: payload.costUsdCents ?? 0,
    },
  });
}

async function handleOpenclawReceived(data) {
  await validatePayload("openclaw.message.received", data);
  const { envelope, signature, stage } = data;
  if (!envelope || !signature) {
    metrics.hmac_reject_total++;
    throw new Error("openclaw.message.received missing envelope or signature");
  }

  const envelopeRaw = typeof envelope === "string" ? envelope : jcs(envelope);
  if (!verifyOpenclawHmac(envelopeRaw, signature)) {
    metrics.hmac_reject_total++;
    throw new Error("openclaw envelope HMAC invalid");
  }

  const parsed = typeof envelope === "string" ? JSON.parse(envelope) : envelope;

  if (parsed.hmac && !verifyNatsApprovalHmac(parsed)) {
    metrics.hmac_reject_total++;
    throw new Error("approval HMAC invalid");
  }

  if (parsed.expires_at && new Date(parsed.expires_at) < new Date()) {
    throw new Error(`approval expired at ${parsed.expires_at}`);
  }

  if (parsed.nonce) {
    const fresh = await checkAndRecordNonce(parsed.nonce);
    if (!fresh) {
      await publishDLQ("openclaw.message.received", data, "replay_nonce");
      throw new Error(`approval nonce replayed: ${parsed.nonce}`);
    }
  }

  const approvalStage = stage || parsed.stage || "unknown";
  clearApprovalTimer(parsed.approval_id);
  // Subject migrated: cortex.approval.<stage> →
  // cortex.signals.<runId>.approval (V12 design — human-in-the-loop
  // resume signals against an in-flight run).
  const runId = parsed.run_id || parsed.runId || parsed.approval_id || "unknown";
  publishEnvelope(
    `cortex.signals.${runId}.approval`,
    `cortex.signal.approval.${runId}.v1`,
    {
      runId,
      name: "approval",
      stage: approvalStage,
      actor: parsed.actor || parsed.approver || "openclaw",
      decision: parsed.decision || approvalStage,
      rationale: parsed.reason || parsed.rationale || null,
      ts: new Date().toISOString(),
    },
    { subject: runId },
  );
  process.stdout.write(`[openclaw.received] re-emitted cortex.signals.${runId}.approval (stage=${approvalStage})\n`);
}

// ---------------------------------------------------------------------------
// JetStream setup
// ---------------------------------------------------------------------------
function mapRetention(value) {
  if (value === "workqueue") return RetentionPolicy.Workqueue;
  if (value === "interest") return RetentionPolicy.Interest;
  return RetentionPolicy.Limits;
}

/**
 * Idempotently create/update streams. Reads declarations from
 * `cfg.streams` (V3) and falls back to the legacy single CORTEX stream when
 * the config omits the array.
 *
 * V3 streams:
 *   - CORTEX_PAPERCLIP_WORK: workqueue retention, dedup window 120s.
 *   - CORTEX_PAPERCLIP_OPS: limits retention, dedup window 120s.
 *   - CORTEX_DLQ: limits retention, 7-day max_age.
 *
 * Existing CORTEX stream keeps `cortex.factory.*`, `openclaw.>`, and any
 * legacy subjects that V3 hasn't shifted to a dedicated stream.
 */
export async function ensureStreams(jsm, cfg) {
  const declared = Array.isArray(cfg?.streams) ? cfg.streams : null;
  if (!declared) {
    // Legacy path — preserved for tests/operators that have not picked up the
    // V3 config shape yet.
    const legacy = [{ name: STREAM, subjects: ["cortex.>", "openclaw.>"] }];
    for (const def of legacy) {
      try { await jsm.streams.info(def.name); }
      catch { await jsm.streams.add({ ...def, storage: StorageType.File }); }
    }
    return;
  }
  // V3 — explicit stream list. Keep the legacy CORTEX stream for factory/
  // openclaw subjects (not in declared list) so existing durables survive.
  const legacyDef = { name: STREAM, subjects: ["cortex.factory.>", "openclaw.>"] };
  try { await jsm.streams.info(legacyDef.name); }
  catch { await jsm.streams.add({ ...legacyDef, storage: StorageType.File }); }
  for (const s of declared) {
    const cfgOpts = {
      name: s.name,
      subjects: s.subjects,
      retention: mapRetention(s.retention),
      storage: StorageType.File,
      duplicate_window: s.duplicate_window_ns,
    };
    if (s.max_age_ns) cfgOpts.max_age = s.max_age_ns;
    if (s.max_msgs_per_subject) cfgOpts.max_msgs_per_subject = s.max_msgs_per_subject;
    try {
      await jsm.streams.info(s.name);
      // update in place to converge retention/dedup window if config changed.
      try { await jsm.streams.update(s.name, cfgOpts); } catch { /* nats version may reject update of certain fields; ignore */ }
    } catch {
      await jsm.streams.add(cfgOpts);
    }
  }
}

async function ensureConsumer(jsm, stream, durable, filterSubject) {
  try { await jsm.consumers.info(stream, durable); }
  catch {
    await jsm.consumers.add(stream, {
      durable_name: durable,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      filter_subject: filterSubject,
      max_deliver: 5,
      ack_wait: nanos(30_000),
      backoff: [nanos(1_000), nanos(5_000), nanos(15_000), nanos(30_000), nanos(60_000)],
    });
  }
}

/**
 * Paperclip-work specific durable: tighter backpressure (max_ack_pending=32)
 * and 60s ack_wait to match the executor budget. Lives on the dedicated
 * CORTEX_PAPERCLIP_WORK workqueue stream so a single consumer dispatches
 * each role-scoped message exactly once.
 */
async function ensurePaperclipWorkConsumer(jsm, stream, durable, filterSubject, opts = {}) {
  const maxDeliver = opts.max_deliver ?? 5;
  const maxAckPending = opts.max_ack_pending ?? 32;
  const ackWaitNs = opts.ack_wait_ns ?? 60_000_000_000;
  const desired = {
    durable_name: durable,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.All,
    filter_subject: filterSubject,
    max_deliver: maxDeliver,
    max_ack_pending: maxAckPending,
    ack_wait: ackWaitNs,
    backoff: [nanos(1_000), nanos(5_000), nanos(15_000), nanos(30_000), nanos(60_000)],
  };
  try {
    await jsm.consumers.info(stream, durable);
    try { await jsm.consumers.update(stream, durable, desired); } catch { /* version-tolerant */ }
  } catch {
    await jsm.consumers.add(stream, desired);
  }
}

async function ensureKV(jsClient) {
  try {
    return await jsClient.views.kv(KV_BUCKET, { ttl: KV_TTL_MS });
  } catch {
    process.stderr.write("[kv] failed to open cortex_approvals_seen; nonce dedup disabled\n");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Health + metrics servers
// ---------------------------------------------------------------------------
function buildMetricsText() {
  const lines = [];
  for (const [k, v] of Object.entries(metrics)) {
    lines.push(`# TYPE ${k} counter\n${k} ${v}`);
  }
  lines.push(
    `# TYPE cortex_consumer_circuit_state gauge\ncortex_consumer_circuit_state{state="${cb.state}"} 1`,
    `# TYPE cortex_consumer_last_message_age_seconds gauge\ncortex_consumer_last_message_age_seconds ${lastMessageAt ? (Date.now() - lastMessageAt) / 1000 : -1}`,
    `# TYPE cortex_consumer_pending_approvals gauge\ncortex_consumer_pending_approvals ${pendingApprovals.size}`,
  );
  return lines.join("\n") + "\n";
}

function startHealthServer() {
  const srv = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      const ok = !shuttingDown && nc && !nc.isClosed();
      const body = JSON.stringify({
        status: ok ? "ok" : "degraded",
        circuit: cb.state,
        last_message_ago_ms: lastMessageAt ? Date.now() - lastMessageAt : null,
        last_error: lastError || null,
        pending_approvals: pendingApprovals.size,
      });
      res.writeHead(ok ? 200 : 503, { "Content-Type": "application/json" });
      res.end(body);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  srv.listen(HEALTH_PORT, HEALTH_HOST, () => process.stdout.write(`[health] ${HEALTH_HOST}:${HEALTH_PORT}/healthz\n`));
  return srv;
}

function startMetricsServer() {
  const srv = http.createServer((req, res) => {
    if (req.url === "/metrics") {
      res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
      res.end(buildMetricsText());
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  srv.listen(METRICS_PORT, METRICS_HOST, () => process.stdout.write(`[metrics] ${METRICS_HOST}:${METRICS_PORT}/metrics\n`));
  return srv;
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------
let heartbeatTimer = null;

function startHeartbeat() {
  heartbeatTimer = setInterval(() => {
    try {
      // Subject: cortex.health.<service> — documented in docs/NATS-CONTRACT.md
      // as a per-service heartbeat namespace.
      publishEnvelope(
        "cortex.health.consumer",
        "cortex.health.consumer.v1",
        {
          service: "cortex-consumer",
          status: "ok",
          ts: new Date().toISOString(),
          uptime_sec: Math.floor(process.uptime()),
          details: {
            circuit: cb.state,
            pending_approvals: pendingApprovals.size,
          },
        },
      );
    } catch (e) {
      process.stderr.write(`[heartbeat] failed: ${e.message}\n`);
    }
  }, 10_000);
  return heartbeatTimer;
}

async function flushFinalHeartbeat() {
  if (!js) return;
  try {
    await js.publish("cortex.health.consumer", sc.encode(JSON.stringify({
      ts: new Date().toISOString(),
      circuit: cb.state,
      pending_approvals: pendingApprovals.size,
      uptime_s: Math.floor(process.uptime()),
      final: true,
    })));
  } catch (e) {
    process.stderr.write(`[heartbeat] final flush failed: ${e.message}\n`);
  }
}

// ---------------------------------------------------------------------------
// Message processing with DLQ fallback
// ---------------------------------------------------------------------------
// Per-message error chain history. Keyed by `${stream}:${seq}` so retries on
// the same JetStream message append rather than overwrite. Bounded to keep
// memory flat under long-running redelivery.
const ERROR_CHAINS = new Map();
const ERROR_CHAINS_MAX = 1024;

function recordError(streamSeqKey, err) {
  const entry = { ts: new Date().toISOString(), message: String(err?.message ?? err) };
  if (err?.code) entry.code = String(err.code);
  const chain = ERROR_CHAINS.get(streamSeqKey) ?? [];
  chain.push(entry);
  if (ERROR_CHAINS.size >= ERROR_CHAINS_MAX) {
    const first = ERROR_CHAINS.keys().next().value;
    if (first) ERROR_CHAINS.delete(first);
  }
  ERROR_CHAINS.set(streamSeqKey, chain);
  return chain;
}

async function processMessage(m, cfg) {
  const subject = m.subject;
  metrics.messages_received_total++;
  lastMessageAt = Date.now();

  let data = {};
  try { data = JSON.parse(sc.decode(m.data)); }
  catch { data = { raw: sc.decode(m.data) }; }

  process.stdout.write(`[recv] ${subject}\n`);

  // Delivery count starts at 0; index 4 = 5th attempt = max_deliver reached
  const deliveryCount = m.info?.redeliveryCount ?? 0;
  const maxDeliver = cfg?.paperclip_work_consumer?.max_deliver ?? 5;
  const streamSeqKey = `${m.info?.stream ?? "?"}:${m.info?.streamSequence ?? m.seq ?? "?"}`;

  try {
    if (subject === "cortex.factory.created") {
      await handleFactoryCreated(data);
    } else if (subject.startsWith("cortex.factory.workflow.")) {
      await handleFactoryWorkflow(subject, data, cfg);
    } else if (subject === "openclaw.message.received") {
      await handleOpenclawReceived(data);
    } else if (subject.startsWith("cortex.paperclip.work.")) {
      await handlePaperclipWork(subject, data, cfg);
    } else {
      process.stdout.write(`[skip] unhandled: ${subject}\n`);
    }
    m.ack();
    metrics.messages_acked_total++;
    ERROR_CHAINS.delete(streamSeqKey);
  } catch (e) {
    lastError = e.message;
    const chain = recordError(streamSeqKey, e);
    process.stderr.write(`[err] ${subject} delivery=${deliveryCount}: ${e.message}\n`);
    if (deliveryCount >= maxDeliver - 1) {
      // Terminal: emit DLQ record on `cortex.dlq.<original>` then ack so
      // JetStream stops redelivery. JetStream DLQ replaces legacy
      // cortex.consumer.errors core publish for paperclip work and any
      // subject that exceeds max_deliver.
      m.ack();
      metrics.messages_dlq_total++;
      try {
        if (js) {
          await publishToDlq(js, subject, data, chain, deliveryCount + 1);
        } else {
          await publishDLQ(subject, data, e.message);
        }
        process.stderr.write(`[dlq] ${subject} after ${deliveryCount + 1} attempts\n`);
      } catch (dlqErr) {
        process.stderr.write(`[dlq] publish failed for ${subject}: ${dlqErr.message}\n`);
      }
      ERROR_CHAINS.delete(streamSeqKey);
    } else {
      const backoffMs = Math.min(1000 * Math.pow(2, deliveryCount), 60_000);
      m.nak(nanos(backoffMs));
      metrics.messages_nacked_total++;
    }
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
let shutdownHandled = false;
async function shutdown(signal, servers) {
  if (shutdownHandled) return;
  shutdownHandled = true;
  process.stdout.write(`[shutdown] ${signal} — draining (max 10s)\n`);
  shuttingDown = true;
  saveThreadState();

  // M-7: stop heartbeat before draining so the timer cannot fire on a draining
  // connection. Then publish one final JetStream-acked heartbeat for forensic
  // closure before nc.drain() blocks new publishes.
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  await flushFinalHeartbeat();

  for (const { timeout } of pendingApprovals.values()) clearTimeout(timeout);
  pendingApprovals.clear();

  const deadline = setTimeout(() => {
    process.stderr.write("[shutdown] deadline exceeded — forcing exit\n");
    process.exit(1);
  }, 10_000);

  for (const s of servers) { try { s.close(); } catch {} }
  try { if (nc && !nc.isClosed()) await nc.drain(); } catch {}
  try { await shutdownTelemetry(); } catch {}

  clearTimeout(deadline);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Poll loop
// ---------------------------------------------------------------------------
async function pollConsumer(consumer, cfg) {
  while (!shuttingDown) {
    try {
      const messages = await consumer.fetch({ max_messages: 10, expires: nanos(30_000) });
      for await (const m of messages) {
        if (shuttingDown) { m.nak(); break; }
        await processMessage(m, cfg);
      }
    } catch (e) {
      if (!shuttingDown) {
        process.stderr.write(`[poll] fetch error: ${e.message}\n`);
        // L-8: back off on fetch errors so a NATS disconnect cannot pin a CPU
        // in a tight retry loop.
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  loadThreadState();
  const cfg = loadConfig();

  // V8 — OpenLLMetry + Langfuse bootstrap. No-op when LANGFUSE_HOST is unset.
  const tel = instrumentTelemetry({ service: "cortex-consumer" });
  if (tel.enabled) {
    process.stdout.write(`[telemetry] enabled service=${tel.service} env=${tel.env}\n`);
  }

  const healthServer = startHealthServer();
  const metricsServer = startMetricsServer();
  const servers = [healthServer, metricsServer];

  process.on("SIGTERM", () => shutdown("SIGTERM", servers));
  process.on("SIGINT", () => shutdown("SIGINT", servers));
  // SIGHUP — clear roster caches so a `systemctl reload` (or `kill -HUP`)
  // picks up edits to `.graph-enabled.json`, `.sandbox-required.json`,
  // `.agentgateway-required.json`, `.approval-required.json` without
  // requiring a process restart.
  process.on("SIGHUP", () => {
    __graphRolesCache = null;
    __sandboxRolesCache = null;
    __agentGatewayRolesCache = null;
    __agentGatewayWarnedNoToken = false;
    __approvalRolesCache = null;
    process.stdout.write("[sighup] roster caches cleared\n");
  });

  nc = await connect({
    servers: NATS_URL,
    reconnect: true,
    maxReconnectAttempts: -1,
    name: "cortex-consumer",
  });

  (async () => {
    for await (const status of nc.status()) {
      process.stdout.write(`[nats] ${status.type} ${status.data || ""}\n`);
    }
  })();

  js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  await ensureStreams(jsm, cfg);
  await ensureConsumer(jsm, STREAM, DURABLES.factoryCreated, "cortex.factory.created");
  await ensureConsumer(jsm, STREAM, DURABLES.factoryWorkflow, "cortex.factory.workflow.>");
  await ensureConsumer(jsm, STREAM, DURABLES.openclawReceived, "openclaw.message.received");
  // V3: paperclip work consumer lives on the dedicated workqueue stream with
  // tightened backpressure (max_ack_pending=32, ack_wait=60s).
  const paperclipWorkStream = (cfg.streams || []).some((s) => s.name === "CORTEX_PAPERCLIP_WORK")
    ? "CORTEX_PAPERCLIP_WORK"
    : STREAM;
  await ensurePaperclipWorkConsumer(
    jsm,
    paperclipWorkStream,
    DURABLES.paperclipWork,
    "cortex.paperclip.work.>",
    cfg.paperclip_work_consumer || {},
  );

  kvBucket = await ensureKV(js);

  const consumers = await Promise.all([
    js.consumers.get(STREAM, DURABLES.factoryCreated),
    js.consumers.get(STREAM, DURABLES.factoryWorkflow),
    js.consumers.get(STREAM, DURABLES.openclawReceived),
    js.consumers.get(paperclipWorkStream, DURABLES.paperclipWork),
  ]);

  startHeartbeat();
  process.stdout.write(`[cortex-consumer] v1.0 ready nats=${NATS_URL} dry_run=${DRY_RUN}\n`);

  await Promise.all(consumers.map(c => pollConsumer(c, cfg)));
  // Heartbeat cleared in shutdown() before nc.drain().
}

// Only auto-run when invoked directly. When imported (e.g. by tests under
// __tests__/), the caller drives validatePayload/loadSchema in isolation
// without connecting to NATS.
const invokedDirectly = process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href;
if (invokedDirectly) {
  main().catch(e => {
    process.stderr.write(`[fatal] ${e.stack || e.message}\n`);
    process.exit(1);
  });
}
