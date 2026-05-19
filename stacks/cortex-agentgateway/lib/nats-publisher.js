// Minimal NATS publisher for cortex-agentgateway audit events.
// Mirrors stacks/cortex-paperclip-bridge/lib/nats-publisher.js (HMAC-signed
// envelope + Nats-Msg-Id stamping for JetStream dedup). Reuses the same
// `{ data, sig }` wire layering documented in docs/NATS-CONTRACT.md.

import { connect, StringCodec, headers as natsHeaders } from "nats";
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

export async function getConnection() {
  if (ncInstance && !ncInstance.isClosed()) return ncInstance;
  if (connecting) return connecting;
  const url = process.env.NATS_URL || "nats://127.0.0.1:4222";
  connecting = connect({
    servers: url,
    reconnect: true,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 1_000,
    name: "cortex-agentgateway",
  })
    .then((nc) => {
      ncInstance = nc;
      connecting = null;
      return nc;
    })
    .catch((e) => {
      connecting = null;
      throw e;
    });
  return connecting;
}

function extractCloudEventId(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.id === "string" && payload.specversion === "1.0") return payload.id;
  return null;
}

export async function publish(subject, payload) {
  const nc = await getConnection();
  const envelope = signEnvelope(payload);
  const id = extractCloudEventId(payload);
  if (id) {
    const h = natsHeaders();
    h.set("Nats-Msg-Id", id);
    nc.publish(subject, sc.encode(JSON.stringify(envelope)), { headers: h });
  } else {
    nc.publish(subject, sc.encode(JSON.stringify(envelope)));
  }
}

export async function close() {
  if (!ncInstance) return;
  try {
    await ncInstance.drain();
  } catch {
    /* ignore */
  }
  ncInstance = null;
}

export { jcs };
