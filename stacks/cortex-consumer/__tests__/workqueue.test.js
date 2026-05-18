// Tests for V3 stream/consumer config — WorkQueue retention on paperclip
// work + backpressure (MaxAckPending=32) on the dedicated durable.
//
// We mock the JetStream manager and assert `ensureStreams` issues the
// correct stream definitions, and that the paperclip-work durable carries
// max_deliver=5, max_ack_pending=32, ack_wait=60s.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
process.env.CORTEX_TEMPLATES_DIR = resolve(repoRoot, "templates");

const { ensureStreams } = await import("../consumer.js");

function mockJsm() {
  const added = [];
  const updated = [];
  return {
    added,
    updated,
    streams: {
      info: async (_name) => { throw new Error("not-found"); },
      add: async (def) => { added.push(def); return def; },
      update: async (name, def) => { updated.push({ name, def }); return def; },
    },
    consumers: {
      info: async () => { throw new Error("not-found"); },
      add: async () => {},
      update: async () => {},
    },
  };
}

test("ensureStreams creates CORTEX_PAPERCLIP_WORK as WorkQueue with 2-min dedup", async () => {
  const jsm = mockJsm();
  const { readFileSync } = await import("node:fs");
  const cfg = JSON.parse(readFileSync(resolve(here, "../config.json"), "utf8"));
  await ensureStreams(jsm, cfg);
  const work = jsm.added.find((d) => d.name === "CORTEX_PAPERCLIP_WORK");
  assert.ok(work, "CORTEX_PAPERCLIP_WORK stream must be declared");
  // nats RetentionPolicy.Workqueue === "workqueue"
  assert.equal(work.retention, "workqueue");
  assert.deepEqual(work.subjects, ["cortex.paperclip.work.>"]);
  assert.equal(work.duplicate_window, 120_000_000_000);
});

test("ensureStreams creates CORTEX_DLQ with 7-day max_age", async () => {
  const jsm = mockJsm();
  const { readFileSync } = await import("node:fs");
  const cfg = JSON.parse(readFileSync(resolve(here, "../config.json"), "utf8"));
  await ensureStreams(jsm, cfg);
  const dlq = jsm.added.find((d) => d.name === "CORTEX_DLQ");
  assert.ok(dlq, "CORTEX_DLQ stream must be declared");
  assert.deepEqual(dlq.subjects, ["cortex.dlq.>"]);
  assert.equal(dlq.max_age, 604_800_000_000_000);
});

test("ensureStreams creates CORTEX_PAPERCLIP_OPS with limits retention", async () => {
  const jsm = mockJsm();
  const { readFileSync } = await import("node:fs");
  const cfg = JSON.parse(readFileSync(resolve(here, "../config.json"), "utf8"));
  await ensureStreams(jsm, cfg);
  const ops = jsm.added.find((d) => d.name === "CORTEX_PAPERCLIP_OPS");
  assert.ok(ops, "CORTEX_PAPERCLIP_OPS stream must be declared");
  assert.equal(ops.retention, "limits");
  assert.ok(ops.subjects.includes("cortex.paperclip.status.>"));
  assert.ok(ops.subjects.includes("cortex.alerts.>"));
});

test("paperclip work consumer config carries V3 backpressure knobs", async () => {
  const { readFileSync } = await import("node:fs");
  const cfg = JSON.parse(readFileSync(resolve(here, "../config.json"), "utf8"));
  assert.ok(cfg.paperclip_work_consumer, "paperclip_work_consumer block required");
  assert.equal(cfg.paperclip_work_consumer.max_deliver, 5);
  assert.equal(cfg.paperclip_work_consumer.max_ack_pending, 32);
  assert.equal(cfg.paperclip_work_consumer.ack_wait_ns, 60_000_000_000);
});
