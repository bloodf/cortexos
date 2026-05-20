import { AckPolicy, DeliverPolicy, StringCodec, nanos } from "nats";
import { fetch } from "undici";
import { getConnection, verifyEnvelope } from "./nats-publisher.js";

const sc = StringCodec();

const STREAM = process.env.CORTEX_ALERTS_STREAM || process.env.CORTEX_STREAM || "CORTEX_PAPERCLIP_OPS";
const DURABLE = process.env.DURABLE_BRIDGE_ALERTS || "cortex-paperclip-bridge-alerts";
const FILTER = "cortex.alerts.>";
const MAX_ATTEMPTS = 6;

const SEVERITY_ORDER = { info: 0, warning: 1, critical: 2 };
const VALID_SEVERITIES = new Set(["info", "warning", "critical"]);

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DIGEST_WINDOW_MS = 5 * 60_000;

let shuttingDown = false;

/**
 * Parse `cortex.alerts.<severity>.<source>` subjects.
 * Returns { severity, source } or null on malformed input.
 */
export function parseSubject(subject) {
  if (typeof subject !== "string") return null;
  const parts = subject.split(".");
  if (parts.length < 4) return null;
  if (parts[0] !== "cortex" || parts[1] !== "alerts") return null;
  const severity = parts[2];
  const source = parts.slice(3).join(".");
  if (!VALID_SEVERITIES.has(severity)) return null;
  if (!source) return null;
  return { severity, source };
}

/**
 * In-memory token bucket: max RATE_LIMIT_MAX per source per RATE_LIMIT_WINDOW_MS.
 * Lost across restarts — acceptable per spec.
 */
export function createRateLimiter({ max = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW_MS, now = () => Date.now() } = {}) {
  const buckets = new Map();
  return {
    allow(source) {
      const t = now();
      const cutoff = t - windowMs;
      const arr = buckets.get(source) || [];
      const pruned = arr.filter((ts) => ts > cutoff);
      if (pruned.length >= max) {
        buckets.set(source, pruned);
        return false;
      }
      pruned.push(t);
      buckets.set(source, pruned);
      return true;
    },
    _buckets: buckets,
  };
}

/**
 * Buffer info-level alerts; flush as a single Paperclip POST every windowMs.
 */
export function createDigestBuffer({ windowMs = DIGEST_WINDOW_MS, onFlush, timers = { setInterval, clearInterval } } = {}) {
  let items = [];
  let timer = null;
  const flush = async () => {
    if (items.length === 0) return;
    const batch = items;
    items = [];
    try {
      await onFlush(batch);
    } catch (e) {
      process.stderr.write(`[alerts] digest flush failed: ${e.message}\n`);
    }
  };
  return {
    add(item) {
      items.push(item);
      if (timer === null) {
        timer = timers.setInterval(() => { flush().catch(() => {}); }, windowMs);
        if (typeof timer.unref === "function") timer.unref();
      }
    },
    flush,
    stop() {
      if (timer !== null) {
        timers.clearInterval(timer);
        timer = null;
      }
    },
    _items: () => items,
  };
}

/**
 * POST a notification to Paperclip. Returns { ok, status, fallback }.
 */
export async function postNotification({ baseUrl, token, body, runId }) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/notifications`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (runId) headers["X-Paperclip-Run-Id"] = runId;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

/**
 * Fallback path: create a comment on the configured ops issue with priority:high label.
 */
export async function fallbackOpsComment({ baseUrl, token, opsIssueId, body }) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/issues/${encodeURIComponent(opsIssueId)}/comments`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      body: `[bridge-alert] ${body.title}\n\n${body.body || ""}\n\nseverity=${body.severity} source=${body.source} ts=${body.timestamp}`,
      labels: ["priority:high"],
    }),
  });
  return { ok: res.ok, status: res.status };
}

/**
 * Process a single envelope. Returns { ok, action } or throws.
 * action ∈ { delivered, fallback, dropped_severity, dropped_rate, digested, disabled }.
 */
export async function handleAlertMessage({ subject, envelope, deps }) {
  const { config, rateLimiter, digest, postFn, fallbackFn } = deps;

  if (!config.enabled) return { ok: true, action: "disabled" };
  if (!verifyEnvelope(envelope)) throw new Error("hmac_invalid");

  const parsed = parseSubject(subject);
  if (!parsed) throw new Error("invalid_subject");

  if (SEVERITY_ORDER[parsed.severity] < SEVERITY_ORDER[config.minSeverity]) {
    return { ok: true, action: "dropped_severity" };
  }

  if (!rateLimiter.allow(parsed.source)) {
    return { ok: true, action: "dropped_rate" };
  }

  const data = envelope.data || {};
  const notification = {
    title: data.title || `${parsed.severity}: ${parsed.source}`,
    body: data.body || "",
    severity: parsed.severity,
    source: parsed.source,
    timestamp: data.timestamp || data.ts || new Date().toISOString(),
    ...(data.metadata ? { metadata: data.metadata } : {}),
  };

  if (config.digestMode && parsed.severity === "info") {
    digest.add(notification);
    return { ok: true, action: "digested" };
  }

  const result = await postFn({
    baseUrl: config.paperclipUrl,
    token: config.paperclipToken,
    body: notification,
    runId: data.runId || null,
  });

  if (result.status === 404 && config.opsIssueId && fallbackFn) {
    const fb = await fallbackFn({
      baseUrl: config.paperclipUrl,
      token: config.paperclipToken,
      opsIssueId: config.opsIssueId,
      body: notification,
    });
    if (!fb.ok) throw new Error(`fallback_failed status=${fb.status}`);
    return { ok: true, action: "fallback" };
  }

  if (!result.ok) throw new Error(`paperclip_post_failed status=${result.status}`);
  return { ok: true, action: "delivered" };
}

export function loadConfig(env = process.env) {
  return {
    enabled: env.BRIDGE_ALERTS_ENABLED !== "0",
    minSeverity: VALID_SEVERITIES.has(env.BRIDGE_ALERTS_MIN_SEVERITY)
      ? env.BRIDGE_ALERTS_MIN_SEVERITY
      : "warning",
    digestMode: env.BRIDGE_ALERTS_DIGEST === "1",
    paperclipUrl: env.PAPERCLIP_API_URL || "",
    paperclipToken: env.PAPERCLIP_API_KEY || "",
    opsIssueId: env.BRIDGE_ALERTS_OPS_ISSUE_ID || "",
  };
}

export async function ensureConsumer(jsm) {
  try { await jsm.consumers.info(STREAM, DURABLE); return; } catch { /* fallthrough */ }
  await jsm.consumers.add(STREAM, {
    durable_name: DURABLE,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.New,
    filter_subject: FILTER,
    max_deliver: MAX_ATTEMPTS,
    ack_wait: nanos(60_000),
    backoff: [
      nanos(1_000),
      nanos(5_000),
      nanos(15_000),
      nanos(60_000),
      nanos(120_000),
      nanos(300_000),
    ],
  });
}

async function poll(consumer, deps) {
  while (!shuttingDown) {
    try {
      const messages = await consumer.fetch({ max_messages: 10, expires: 30_000 });
      for await (const m of messages) {
        if (shuttingDown) { m.nak(); break; }
        const deliveryCount = m.info?.redeliveryCount ?? 0;
        let envelope = null;
        try {
          envelope = JSON.parse(sc.decode(m.data));
          await handleAlertMessage({ subject: m.subject, envelope, deps });
          m.ack();
        } catch (e) {
          process.stderr.write(`[alerts] error subject=${m.subject} delivery=${deliveryCount}: ${e.message}\n`);
          if (deliveryCount >= MAX_ATTEMPTS - 1) {
            m.ack();
          } else {
            const delayMs = Math.min(1000 * Math.pow(2, deliveryCount), 5 * 60 * 1000);
            m.nak(delayMs);
          }
        }
      }
    } catch (e) {
      if (!shuttingDown) {
        process.stderr.write(`[alerts] fetch error: ${e.message}\n`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
}

export async function runAlerts({ getConn = getConnection } = {}) {
  const config = loadConfig();
  if (!config.enabled) {
    process.stdout.write(`[alerts] disabled via BRIDGE_ALERTS_ENABLED=0 — task exiting\n`);
    return;
  }
  if (!config.paperclipUrl || !config.paperclipToken) {
    process.stderr.write(`[alerts] PAPERCLIP_API_URL / PAPERCLIP_API_KEY not set — alerts task disabled\n`);
    return;
  }

  const nc = await getConn();
  const jsm = await nc.jetstreamManager();
  await ensureConsumer(jsm);
  const js = nc.jetstream();
  const consumer = await js.consumers.get(STREAM, DURABLE);

  const rateLimiter = createRateLimiter();
  const digest = createDigestBuffer({
    onFlush: async (batch) => {
      const summary = batch.map((b) => `- [${b.source}] ${b.title}`).join("\n");
      await postNotification({
        baseUrl: config.paperclipUrl,
        token: config.paperclipToken,
        body: {
          title: `Alerts digest (${batch.length} info)`,
          body: summary,
          severity: "info",
          source: "bridge-digest",
          timestamp: new Date().toISOString(),
        },
      });
    },
  });

  const deps = {
    config,
    rateLimiter,
    digest,
    postFn: postNotification,
    fallbackFn: fallbackOpsComment,
  };

  process.stdout.write(`[alerts] ready durable=${DURABLE} filter=${FILTER} minSeverity=${config.minSeverity} digest=${config.digestMode}\n`);

  const shutdown = (sig) => {
    process.stdout.write(`[alerts] ${sig} — draining\n`);
    shuttingDown = true;
    digest.stop();
    digest.flush().catch(() => {});
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  await poll(consumer, deps);
}
