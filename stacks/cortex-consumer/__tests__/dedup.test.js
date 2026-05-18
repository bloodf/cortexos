// Tests for Nats-Msg-Id dedup wiring (V3).
//
// No embedded NATS server: we assert that the consumer's publish path stamps
// the `Nats-Msg-Id` header equal to the CloudEvents id, and that the bridge's
// publish helper does the same. Real dedup behavior is provided by the
// JetStream server when `duplicate_window > 0` is configured on the stream,
// which is asserted in workqueue.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
process.env.CORTEX_TEMPLATES_DIR = resolve(repoRoot, "templates");

const { buildMsgIdHeaders } = await import("../lib/dlq.js");

test("buildMsgIdHeaders returns MsgHdrs with Nats-Msg-Id set", () => {
  const h = buildMsgIdHeaders("evt-abc-123");
  // nats MsgHdrs exposes .get(name) (and .set). Be tolerant of either.
  const v = h.get ? h.get("Nats-Msg-Id") : h["Nats-Msg-Id"];
  assert.equal(v, "evt-abc-123");
});

test("config declares 2-minute duplicate window on workqueue + ops + dlq streams", async () => {
  const { readFileSync } = await import("node:fs");
  const cfg = JSON.parse(readFileSync(resolve(here, "../config.json"), "utf8"));
  assert.ok(Array.isArray(cfg.streams), "streams[] must be declared");
  const byName = Object.fromEntries(cfg.streams.map((s) => [s.name, s]));
  for (const name of ["CORTEX_PAPERCLIP_WORK", "CORTEX_PAPERCLIP_OPS", "CORTEX_DLQ"]) {
    assert.ok(byName[name], `${name} missing from config.streams`);
    assert.equal(byName[name].duplicate_window_ns, 120_000_000_000, `${name} dedup window must be 2 min`);
  }
});
