import { AckPolicy, DeliverPolicy, StringCodec, nanos } from "nats";
import { getConnection, verifyEnvelope, publish } from "./lib/nats-publisher.js";
import { updateStatus } from "./lib/idempotency.js";
import { PaperclipClient } from "./lib/paperclip-client.js";
import { validate as validateCloudEvent, EnvelopeValidationError } from "@cortexos/events";

const REQUIRE_ENVELOPE = process.env.CORTEX_REQUIRE_ENVELOPE === "1";

const sc = StringCodec();
const STREAM = process.env.CORTEX_STREAM || "CORTEX";
const DURABLE = process.env.DURABLE_BRIDGE_STATUS || "cortex-paperclip-bridge-status";
const FILTER = "cortex.paperclip.status.>";
const MAX_ATTEMPTS = 6;

let shuttingDown = false;

export async function ensureConsumer(jsm) {
  try { await jsm.consumers.info(STREAM, DURABLE); return; } catch { /* fallthrough */ }
  await jsm.consumers.add(STREAM, {
    durable_name: DURABLE,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.All,
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

export function buildClient() {
  return new PaperclipClient({
    baseUrl: process.env.PAPERCLIP_API_URL,
    token: process.env.PAPERCLIP_API_KEY,
  });
}

export async function handleStatusMessage(envelope, client) {
  if (!verifyEnvelope(envelope)) {
    throw new Error("hmac_invalid");
  }
  // envelope.data is either a CloudEvents object (v2) or the legacy raw payload (v1).
  const inner = envelope.data;
  let data;
  if (inner && typeof inner === "object" && inner.specversion === "1.0" && inner.type) {
    try {
      validateCloudEvent(inner);
    } catch (e) {
      if (REQUIRE_ENVELOPE) {
        const detail = e instanceof EnvelopeValidationError ? JSON.stringify(e.errors) : e.message;
        throw new Error(`cloudevents_invalid: ${detail}`);
      }
      process.stderr.write(`[worker] cloudevents validation warning: ${e.message}\n`);
    }
    data = inner.data;
  } else {
    if (REQUIRE_ENVELOPE) throw new Error("cloudevents_required");
    process.stderr.write("[worker] legacy non-cloudevents payload accepted (CORTEX_REQUIRE_ENVELOPE=0)\n");
    data = inner;
  }
  const { runId, issueId, status, comment, costUsdCents } = data;
  if (!runId || !issueId || !status) throw new Error("missing_fields");

  const body = { status, comment: comment || "", costUsdCents: costUsdCents || 0 };
  const res = await client.patchIssue(issueId, body, runId);
  if (!res.ok) {
    throw new Error(`paperclip_patch_failed status=${res.status}`);
  }
  await updateStatus(runId, status, costUsdCents ?? null);
  return { runId, status };
}

async function poll(consumer, client) {
  while (!shuttingDown) {
    try {
      const messages = await consumer.fetch({ max_messages: 10, expires: nanos(30_000) });
      for await (const m of messages) {
        if (shuttingDown) { m.nak(); break; }
        const deliveryCount = m.info?.redeliveryCount ?? 0;
        let envelope = null;
        try {
          envelope = JSON.parse(sc.decode(m.data));
          await handleStatusMessage(envelope, client);
          m.ack();
        } catch (e) {
          process.stderr.write(`[worker] error subject=${m.subject} delivery=${deliveryCount}: ${e.message}\n`);
          if (deliveryCount >= MAX_ATTEMPTS - 1) {
            try {
              await publish("cortex.alerts.error.bridge-status-stuck", {
                runId: envelope?.data?.data?.runId ?? envelope?.data?.runId ?? null,
                issueId: envelope?.data?.data?.issueId ?? envelope?.data?.issueId ?? null,
                reason: e.message,
                ts: new Date().toISOString(),
              });
            } catch { /* alerts plugin not present in P2 */ }
            m.ack();
          } else {
            const delayMs = Math.min(1000 * Math.pow(2, deliveryCount), 5 * 60 * 1000);
            m.nak(nanos(delayMs));
          }
        }
      }
    } catch (e) {
      if (!shuttingDown) {
        process.stderr.write(`[worker] fetch error: ${e.message}\n`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
}

async function main() {
  const nc = await getConnection();
  const jsm = await nc.jetstreamManager();
  await ensureConsumer(jsm);
  const js = nc.jetstream();
  const consumer = await js.consumers.get(STREAM, DURABLE);
  const client = buildClient();
  process.stdout.write(`[worker] ready durable=${DURABLE} filter=${FILTER}\n`);

  const shutdown = (sig) => {
    process.stdout.write(`[worker] ${sig} — draining\n`);
    shuttingDown = true;
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  await poll(consumer, client);
}

const invokedDirectly = process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href;
if (invokedDirectly) {
  main().catch((e) => {
    process.stderr.write(`[worker] fatal: ${e.stack || e.message}\n`);
    process.exit(1);
  });
}
