/**
 * V12 — Consumer-side NATS-signal client.
 *
 * Mirrors `stacks/cortex-paperclip-bridge/lib/signals.js` but takes the
 * already-connected NATS handle from the consumer (it never owns its own
 * connection). The contract is:
 *
 *   const decision = await awaitSignal({ nc, runId, signalName, timeoutSec });
 *
 * On success: returns the verified signal data.
 * On timeout: publishes `cortex.alerts.warning.approval-timeout` and rejects.
 *
 * Stream config (`CORTEX_SIGNALS`, max_msgs_per_subject=1) is provisioned by
 * `ensureStreams` in consumer.js — this module assumes the stream exists.
 */
import { AckPolicy, DeliverPolicy, StringCodec, nanos } from "nats";
import { createHmac } from "node:crypto";
import { envelope as buildCloudEvent, validate as validateCloudEvent } from "@cortexos/events";

const sc = StringCodec();

export const SIGNALS_STREAM = process.env.CORTEX_SIGNALS_STREAM || "CORTEX_SIGNALS";
export const SIGNALS_SUBJECT_PREFIX = "cortex.signals";

function jcs(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${jcs(value[k])}`).join(",")}}`;
}

export function signalSubject(runId, signalName) {
  if (typeof runId !== "string" || !runId) throw new Error("signalSubject: runId required");
  if (typeof signalName !== "string" || !signalName) throw new Error("signalSubject: signalName required");
  if (/[\s.>*]/.test(runId)) throw new Error(`signalSubject: invalid runId ${runId}`);
  if (/[\s.>*]/.test(signalName)) throw new Error(`signalSubject: invalid signalName ${signalName}`);
  return `${SIGNALS_SUBJECT_PREFIX}.${runId}.${signalName}`;
}

export function decodeSignal(raw, { secret } = {}) {
  const useSecret = secret || process.env.CORTEX_NATS_HMAC || "";
  if (!useSecret) throw new Error("CORTEX_NATS_HMAC not configured");
  let envelope;
  try {
    envelope = JSON.parse(typeof raw === "string" ? raw : sc.decode(raw));
  } catch (e) {
    throw new Error(`signal payload not JSON: ${e.message}`);
  }
  if (!envelope || typeof envelope !== "object" || !envelope.data || !envelope.sig) {
    throw new Error("signal envelope missing data/sig");
  }
  const expected = createHmac("sha256", useSecret).update(jcs(envelope.data)).digest("hex");
  if (expected !== envelope.sig) throw new Error("signal envelope HMAC invalid");
  const inner = envelope.data;
  if (inner && typeof inner === "object" && inner.specversion === "1.0" && inner.type) {
    return inner.data ?? null;
  }
  return inner;
}

async function publishApprovalTimeoutAlert({ nc, runId, signalName, timeoutSec }) {
  try {
    const data = {
      severity: "warning",
      source: "approval-timeout",
      message: `signal ${signalName} timed out after ${timeoutSec}s for run ${runId}`,
      metadata: { runId, signalName, timeoutSec },
    };
    const ce = buildCloudEvent({
      type: `cortex.alerts.warning.approval-timeout.v1`,
      source: "cortex-consumer",
      subject: runId,
      data,
    });
    try { validateCloudEvent(ce); } catch { /* best-effort */ }
    const secret = process.env.CORTEX_NATS_HMAC || "";
    if (!secret) return;
    const sig = createHmac("sha256", secret).update(jcs(ce)).digest("hex");
    nc.publish("cortex.alerts.warning.approval-timeout", sc.encode(JSON.stringify({ data: ce, sig })));
  } catch (e) {
    process.stderr.write(`[signals] alert publish failed: ${e.message}\n`);
  }
}

/**
 * Wait for a signal published to `cortex.signals.<runId>.<signalName>`.
 * Uses a JetStream ephemeral consumer with DeliverLastPerSubject so a
 * decision already on the stream is delivered immediately even if the
 * caller subscribed late.
 *
 * @param {object} args
 * @param {import("nats").NatsConnection} args.nc Live NATS handle.
 * @param {string} args.runId
 * @param {string} args.signalName
 * @param {number} args.timeoutSec
 * @param {function} [args.alertFn] Override for the timeout-alert publisher.
 * @returns {Promise<object>}
 */
export async function awaitSignal({ nc, runId, signalName, timeoutSec, alertFn }) {
  const subject = signalSubject(runId, signalName);
  const timeoutMs = Math.max(0, Math.floor(Number(timeoutSec) * 1000));
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("awaitSignal: timeoutSec must be > 0");
  }
  if (!nc) throw new Error("awaitSignal: nc required");

  const jsm = await nc.jetstreamManager();
  const js = nc.jetstream();

  // Ephemeral consumer scoped to this subject. JetStream removes it after
  // `inactive_threshold` elapses with no fetch; we also explicitly delete
  // on resolve / reject below.
  const ci = await jsm.consumers.add(SIGNALS_STREAM, {
    ack_policy: AckPolicy.None,
    deliver_policy: DeliverPolicy.LastPerSubject,
    filter_subject: subject,
    inactive_threshold: nanos(Math.max(timeoutMs * 2, 60_000)),
  });
  const consumer = await js.consumers.get(SIGNALS_STREAM, ci.name);

  let settled = false;
  let timer = null;
  const cleanup = async () => {
    if (timer) { clearTimeout(timer); timer = null; }
    try { await jsm.consumers.delete(SIGNALS_STREAM, ci.name); } catch { /* ignore */ }
  };

  return new Promise((resolve, reject) => {
    timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      const fn = alertFn || publishApprovalTimeoutAlert;
      try { await fn({ nc, runId, signalName, timeoutSec }); } catch { /* swallow */ }
      await cleanup();
      reject(new Error(`awaitSignal timed out after ${timeoutSec}s for ${subject}`));
    }, timeoutMs);
    if (typeof timer.unref === "function") timer.unref();

    (async () => {
      try {
        const messages = await consumer.fetch({
          max_messages: 1,
          expires: nanos(Math.min(timeoutMs, 30_000)),
        });
        for await (const m of messages) {
          if (settled) { try { m.ack(); } catch {} break; }
          try {
            const decoded = decodeSignal(m.data);
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
        if (settled) return;
        const sub = await consumer.consume();
        for await (const m of sub) {
          if (settled) { try { m.ack(); } catch {} break; }
          try {
            const decoded = decodeSignal(m.data);
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
