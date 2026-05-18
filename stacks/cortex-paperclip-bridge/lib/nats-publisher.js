import { connect, StringCodec } from "nats";
import { createHmac } from "node:crypto";

const sc = StringCodec();
let ncInstance = null;
let connecting = null;

function jcs(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${jcs(value[k])}`).join(",")}}`;
}

export function signEnvelope(data, secret = process.env.CORTEX_NATS_HMAC || "") {
  if (!secret) throw new Error("CORTEX_NATS_HMAC not configured");
  const sig = createHmac("sha256", secret).update(jcs(data)).digest("hex");
  return { data, sig };
}

export function verifyEnvelope(envelope, secret = process.env.CORTEX_NATS_HMAC || "") {
  if (!secret) return false;
  if (!envelope || typeof envelope !== "object") return false;
  const { data, sig } = envelope;
  if (!data || !sig) return false;
  const expected = createHmac("sha256", secret).update(jcs(data)).digest("hex");
  return expected === sig;
}

export async function getConnection() {
  if (ncInstance && !ncInstance.isClosed()) return ncInstance;
  if (connecting) return connecting;
  const url = process.env.NATS_URL || "nats://127.0.0.1:4222";
  connecting = connect({
    servers: url,
    reconnect: true,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 1_000,
    name: "cortex-paperclip-bridge",
  }).then((nc) => {
    ncInstance = nc;
    connecting = null;
    return nc;
  }).catch((e) => {
    connecting = null;
    throw e;
  });
  return connecting;
}

export async function publish(subject, payload) {
  const nc = await getConnection();
  const envelope = signEnvelope(payload);
  nc.publish(subject, sc.encode(JSON.stringify(envelope)));
}

export async function getJetStreamManager() {
  const nc = await getConnection();
  return nc.jetstreamManager();
}

export async function getJetStream() {
  const nc = await getConnection();
  return nc.jetstream();
}

export async function close() {
  if (!ncInstance) return;
  try { await ncInstance.drain(); } catch { /* ignore */ }
  ncInstance = null;
}

export { jcs };
