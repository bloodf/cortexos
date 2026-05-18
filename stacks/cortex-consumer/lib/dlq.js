/**
 * DLQ helper — emit terminal failure record after JetStream `max_deliver`
 * exhausts. The original message is acked by the caller (so JetStream stops
 * redelivering), and a CloudEvents-wrapped DLQ record lands on
 * `cortex.dlq.<original-subject>` with the full error chain.
 *
 * Subject layering:
 *   cortex.paperclip.work.ENG-BACKEND  → cortex.dlq.cortex.paperclip.work.ENG-BACKEND
 *
 * The Nats-Msg-Id is a fresh uuid (per DLQ record). Each terminal failure is
 * a distinct event — we do not want JetStream dedup to collapse two genuine
 * failures into one record.
 */
import { randomUUID } from "node:crypto";
import { envelope as buildCloudEvent } from "@cortexos/events";
import { headers as natsHeaders } from "nats";

/**
 * @param {object} js          JetStream client (nc.jetstream()).
 * @param {string} originalSubject  subject that failed (`m.subject`).
 * @param {*}      originalEvent    decoded original message body (CloudEvents or legacy).
 * @param {Array<{ts:string,message:string,code?:string}>} errorChain  attempts in order.
 * @param {number} attempts        total delivery attempts.
 * @returns {Promise<{id:string, subject:string}>}
 */
export async function publishToDlq(js, originalSubject, originalEvent, errorChain, attempts) {
  if (!js || typeof js.publish !== "function") {
    throw new Error("publishToDlq: js client missing publish()");
  }
  if (typeof originalSubject !== "string" || !originalSubject) {
    throw new Error("publishToDlq: originalSubject required");
  }
  const originalNamespace = originalSubject
    .split(".")
    .slice(0, 3)
    .join("-")
    .replace(/[^A-Za-z0-9.-]/g, "_");
  const ce = buildCloudEvent({
    type: `cortex.dlq.${originalNamespace}.v1`,
    source: "cortex-consumer",
    subject: originalSubject,
    data: {
      originalSubject,
      originalEvent,
      errorChain: Array.isArray(errorChain) ? errorChain : [],
      attempts: Number.isFinite(attempts) ? attempts : 0,
      terminalAt: new Date().toISOString(),
    },
  });
  // Override id with deterministic-fresh value (envelope already sets uuidv4,
  // but we expose it so callers can dedup downstream consumers if desired).
  ce.id = randomUUID();
  const dlqSubject = `cortex.dlq.${originalSubject}`;
  const payload = new TextEncoder().encode(JSON.stringify(ce));
  await js.publish(dlqSubject, payload, {
    headers: buildMsgIdHeaders(ce.id),
  });
  return { id: ce.id, subject: dlqSubject };
}

/**
 * Build a NATS MsgHdrs with `Nats-Msg-Id` set. JetStream uses this header as
 * the dedup key (within the stream's duplicate_window).
 */
export function buildMsgIdHeaders(id) {
  const h = natsHeaders();
  h.set("Nats-Msg-Id", id);
  return h;
}
