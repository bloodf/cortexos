/**
 * V12 — NATS-signal approvals (Temporal-shaped).
 *
 * `awaitSignal(runId, signalName, timeoutSec, opts)` subscribes the JetStream
 * stream `CORTEX_SIGNALS` filtered to `cortex.signals.<runId>.<signalName>`
 * with `--last-per-subject` semantics. Resolves with the decoded signal data
 * on the first message that passes HMAC verification, or rejects after
 * `timeoutSec` seconds. On timeout a `cortex.alerts.warning.approval-timeout`
 * alert is published before the rejection propagates so operators can wire
 * the alerts pipeline to escalations without subscribing to the signal
 * subject directly.
 *
 * The library is deliberately consumer-agnostic: the caller (cortex-consumer
 * or any future Temporal-shaped worker) owns the surrounding control-flow.
 * The contract is closer to a Temporal `workflow.signal` await than to a
 * generic NATS subscription:
 *
 *   const decision = await awaitSignal(runId, "approval", 86_400);
 *   if (decision.decision === "approve") { ... }
 */
import { AckPolicy, DeliverPolicy, StringCodec, nanos } from "nats";
import { envelope as buildCloudEvent, validate as validateCloudEvent } from "@cortexos/events";
import {
  getConnection,
  getJetStreamManager,
  getJetStream,
  signEnvelope,
  verifyEnvelope,
  publish as publishSigned,
} from "./nats-publisher.js";

const sc = StringCodec();

export const SIGNALS_STREAM = process.env.CORTEX_SIGNALS_STREAM || "CORTEX_SIGNALS";
export const SIGNALS_SUBJECT_PREFIX = "cortex.signals";

export function signalSubject(runId, signalName) {
  if (typeof runId !== "string" || !runId) {
    throw new Error("signalSubject: runId required");
  }
  if (typeof signalName !== "string" || !signalName) {
    throw new Error("signalSubject: signalName required");
  }
  if (/[\s.>*]/.test(runId)) {
    throw new Error(`signalSubject: invalid runId ${runId}`);
  }
  if (/[\s.>*]/.test(signalName)) {
    throw new Error(`signalSubject: invalid signalName ${signalName}`);
  }
  return `${SIGNALS_SUBJECT_PREFIX}.${runId}.${signalName}`;
}

/**
 * Idempotently ensure the CORTEX_SIGNALS stream exists. Caller may pass a
 * JetStreamManager from a shared connection; otherwise the bridge's own
 * connection is used.
 */
export async function ensureSignalsStream(jsmIn) {
  const jsm = jsmIn || (await getJetStreamManager());
  const opts = {
    name: SIGNALS_STREAM,
    subjects: [`${SIGNALS_SUBJECT_PREFIX}.>`],
    max_msgs_per_subject: 1,
    max_age: nanos(24 * 60 * 60 * 1000),
    duplicate_window: nanos(120 * 1000),
  };
  try {
    await jsm.streams.info(SIGNALS_STREAM);
    try { await jsm.streams.update(SIGNALS_STREAM, opts); } catch { /* version-tolerant */ }
  } catch {
    await jsm.streams.add(opts);
  }
}

/**
 * Decode a NATS message body into the inner signal data.
 *
 * Supported shapes:
 *   - `{ data: <CloudEvent>, sig }` — preferred. CloudEvent.data is the
 *     signal payload as defined in schemas/cortex-signal-v1.json.
 *   - `{ data: <signal>, sig }` — legacy raw signal payload.
 *
 * Returns the decoded signal object or throws on HMAC / shape failure.
 */
export function decodeSignal(raw, { secret } = {}) {
  let envelope;
  try {
    envelope = JSON.parse(typeof raw === "string" ? raw : sc.decode(raw));
  } catch (e) {
    throw new Error(`signal payload not JSON: ${e.message}`);
  }
  if (!envelope || typeof envelope !== "object" || !envelope.data || !envelope.sig) {
    throw new Error("signal envelope missing data/sig");
  }
  if (!verifyEnvelope(envelope, secret)) {
    throw new Error("signal envelope HMAC invalid");
  }
  const inner = envelope.data;
  if (inner && typeof inner === "object" && inner.specversion === "1.0" && inner.type) {
    return inner.data ?? null;
  }
  return inner;
}

/**
 * Publish an alert without coupling alert callers to the signals module.
 * Kept private; awaitSignal is the only caller today.
 */
async function publishApprovalTimeoutAlert({ runId, signalName, timeoutSec }) {
  try {
    const data = {
      severity: "warning",
      source: "approval-timeout",
      message: `signal ${signalName} timed out after ${timeoutSec}s for run ${runId}`,
      metadata: { runId, signalName, timeoutSec },
    };
    const ce = buildCloudEvent({
      type: `cortex.alerts.warning.approval-timeout.v1`,
      source: "cortex-paperclip-bridge",
      subject: runId,
      data,
    });
    try { validateCloudEvent(ce); } catch { /* best-effort */ }
    await publishSigned(`cortex.alerts.warning.approval-timeout`, ce);
  } catch (e) {
    process.stderr.write(`[signals] alert publish failed: ${e.message}\n`);
  }
}

/**
 * Subscribe to `cortex.signals.<runId>.<signalName>` with deliver-last-per-
 * subject semantics. Resolves on the first verified signal or rejects on
 * timeout. The function creates an ephemeral push consumer scoped to the
 * single subject so multiple concurrent awaiters do not steal each other's
 * messages.
 *
 * @param {string} runId
 * @param {string} signalName
 * @param {number} timeoutSec
 * @param {object} [opts]
 * @param {string} [opts.secret] HMAC secret override (mainly for tests).
 * @param {object} [opts.nc] Pre-built NATS connection (test injection).
 * @param {function} [opts.alertFn] Override for the timeout-alert publisher.
 * @returns {Promise<object>} Resolved signal data.
 */
export async function awaitSignal(runId, signalName, timeoutSec, opts = {}) {
  const subject = signalSubject(runId, signalName);
  const timeoutMs = Math.max(0, Math.floor(Number(timeoutSec) * 1000)) || 0;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("awaitSignal: timeoutSec must be > 0");
  }

  const nc = opts.nc || (await getConnection());
  const jsm = await nc.jetstreamManager();
  await ensureSignalsStream(jsm);
  const js = nc.jetstream();

  // Ephemeral consumer with DeliverLastPerSubject so a late awaiter still
  // gets the prior decision (last-write-wins semantics that map cleanly to
  // Temporal signals).
  const consumerCfg = {
    ack_policy: AckPolicy.None,
    deliver_policy: DeliverPolicy.LastPerSubject,
    filter_subject: subject,
    inactive_threshold: nanos(Math.max(timeoutMs * 2, 60_000)),
  };
  const ci = await jsm.consumers.add(SIGNALS_STREAM, consumerCfg);
  const consumer = await js.consumers.get(SIGNALS_STREAM, ci.name);

  let timer = null;
  let settled = false;
  const cleanup = async () => {
    if (timer) { clearTimeout(timer); timer = null; }
    try { await jsm.consumers.delete(SIGNALS_STREAM, ci.name); } catch { /* ignore */ }
  };

  return new Promise((resolve, reject) => {
    timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      const alertFn = opts.alertFn || publishApprovalTimeoutAlert;
      try { await alertFn({ runId, signalName, timeoutSec }); } catch { /* best-effort */ }
      await cleanup();
      reject(new Error(`awaitSignal timed out after ${timeoutSec}s for ${subject}`));
    }, timeoutMs);
    if (typeof timer.unref === "function") timer.unref();

    (async () => {
      try {
        // Fetch loop: one message is enough; LastPerSubject means JetStream
        // re-delivers the most recent message immediately if it exists.
        const messages = await consumer.fetch({
          max_messages: 1,
          expires: nanos(Math.min(timeoutMs, 30_000)),
        });
        for await (const m of messages) {
          if (settled) { try { m.ack(); } catch {} break; }
          try {
            const decoded = decodeSignal(m.data, { secret: opts.secret });
            settled = true;
            try { m.ack(); } catch { /* ack_policy=None: noop */ }
            await cleanup();
            resolve(decoded);
            return;
          } catch (e) {
            // Bad envelope — ack and keep waiting via consume() fallback.
            try { m.ack(); } catch {}
            process.stderr.write(`[signals] reject ${subject}: ${e.message}\n`);
          }
        }
        // No message yet — switch to consume() for streaming delivery until
        // timeout. consume() is a long-lived iterator that surfaces new
        // publishes on the subject without re-issuing fetch round-trips.
        if (settled) return;
        const sub = await consumer.consume();
        for await (const m of sub) {
          if (settled) { try { m.ack(); } catch {} break; }
          try {
            const decoded = decodeSignal(m.data, { secret: opts.secret });
            settled = true;
            try { m.ack(); } catch {}
            await cleanup();
            resolve(decoded);
            return;
          } catch (e) {
            try { m.ack(); } catch {}
            process.stderr.write(`[signals] reject ${subject}: ${e.message}\n`);
          }
        }
      } catch (e) {
        if (settled) return;
        settled = true;
        await cleanup();
        reject(e);
      }
    })().catch(async (e) => {
      if (settled) return;
      settled = true;
      await cleanup();
      reject(e);
    });
  });
}

/**
 * Helper for callers that already have a signed envelope: publish a signal
 * to `cortex.signals.<runId>.<signalName>`. Kept here to keep the wire
 * format in one place; not used by `awaitSignal` itself.
 */
export async function publishSignal({ runId, signalName, decision, approver, reason }) {
  const subject = signalSubject(runId, signalName);
  const data = {
    runId,
    signalName,
    decision,
    approver,
    ts: new Date().toISOString(),
    ...(reason ? { reason } : {}),
  };
  const ce = buildCloudEvent({
    type: `cortex.signal.${signalName}.${runId}.v1`,
    source: "cortex-dashboard",
    subject: runId,
    data,
  });
  await publishSigned(subject, ce);
  return { subject, data };
}

export { signEnvelope };
