// Unit tests for the DLQ publisher (V3).
//
// Run via: `pnpm test` (node --test) inside stacks/cortex-consumer.
//
// These tests mock the JetStream client — no embedded NATS server is needed.
// Integration coverage (real max_deliver→DLQ flow) is documented in
// docs/NATS-CONTRACT.md and validated in CI via the bridge integration suite.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
process.env.CORTEX_TEMPLATES_DIR = resolve(repoRoot, "templates");

const { publishToDlq } = await import("../lib/dlq.js");

function mockJs() {
  const published = [];
  return {
    published,
    publish: async (subject, data, opts) => {
      published.push({ subject, data, opts });
      return { stream: "CORTEX_DLQ", seq: 1 };
    },
  };
}

test("publishToDlq emits CloudEvents envelope on cortex.dlq.<original>", async () => {
  const js = mockJs();
  const original = {
    specversion: "1.0",
    id: "orig-id-123",
    type: "cortex.paperclip.work.ENG-BACKEND.v1",
    source: "cortex-paperclip-bridge",
    data: { runId: "run_1", role: "ENG-BACKEND" },
  };
  const chain = [
    { ts: "2026-05-17T00:00:01Z", message: "boom 1" },
    { ts: "2026-05-17T00:00:02Z", message: "boom 2", code: "E_FAIL" },
  ];
  const result = await publishToDlq(js, "cortex.paperclip.work.ENG-BACKEND", original, chain, 5);
  assert.equal(js.published.length, 1);
  const { subject, data, opts } = js.published[0];
  assert.equal(subject, "cortex.dlq.cortex.paperclip.work.ENG-BACKEND");
  // payload is JSON-encoded CloudEvents envelope
  const decoded = JSON.parse(new TextDecoder().decode(data));
  assert.equal(decoded.specversion, "1.0");
  assert.equal(decoded.source, "cortex-consumer");
  assert.ok(decoded.type.startsWith("cortex.dlq."));
  assert.equal(decoded.data.originalSubject, "cortex.paperclip.work.ENG-BACKEND");
  assert.equal(decoded.data.attempts, 5);
  assert.equal(decoded.data.errorChain.length, 2);
  assert.equal(decoded.data.errorChain[1].code, "E_FAIL");
  assert.match(decoded.data.terminalAt, /^\d{4}-\d{2}-\d{2}T/);
  // Nats-Msg-Id header must equal the DLQ envelope id (per-DLQ uniqueness)
  assert.ok(opts && opts.headers, "headers must be set on publish");
  const msgId = opts.headers.get ? opts.headers.get("Nats-Msg-Id") : opts.headers["Nats-Msg-Id"];
  assert.equal(msgId, decoded.id);
  assert.equal(result.id, decoded.id);
  assert.equal(result.subject, "cortex.dlq.cortex.paperclip.work.ENG-BACKEND");
});

test("publishToDlq accepts empty errorChain and zero attempts safely", async () => {
  const js = mockJs();
  await publishToDlq(js, "cortex.paperclip.work.OPS", { foo: 1 }, [], 0);
  const decoded = JSON.parse(new TextDecoder().decode(js.published[0].data));
  assert.deepEqual(decoded.data.errorChain, []);
  assert.equal(decoded.data.attempts, 0);
});

test("publishToDlq rejects on missing js client or subject", async () => {
  await assert.rejects(() => publishToDlq(null, "x", {}, [], 1), /js client/);
  await assert.rejects(() => publishToDlq({ publish: async () => {} }, "", {}, [], 1), /originalSubject/);
});

test("each DLQ publish gets a fresh uuid (no dedup collapse)", async () => {
  const js = mockJs();
  await publishToDlq(js, "cortex.paperclip.work.OPS", { a: 1 }, [], 1);
  await publishToDlq(js, "cortex.paperclip.work.OPS", { a: 1 }, [], 1);
  const id1 = JSON.parse(new TextDecoder().decode(js.published[0].data)).id;
  const id2 = JSON.parse(new TextDecoder().decode(js.published[1].data)).id;
  assert.notEqual(id1, id2, "DLQ records must each have a unique id");
});
