// V12 — consumer-side awaitSignal + config + roster smoke tests.
//
// We exercise:
//   - signalSubject builder rejects malformed inputs.
//   - decodeSignal verifies HMAC + extracts CloudEvents inner data.
//   - awaitSignal rejects with timed-out error and publishes the warning alert.
//   - config.json declares CORTEX_SIGNALS with last-per-subject semantics.
//   - the approval-required roster ships at least one role.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createHmac } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
process.env.CORTEX_TEMPLATES_DIR = resolve(repoRoot, "templates");
process.env.CORTEX_NATS_HMAC = "consumer-signal-test-hmac";

const { signalSubject, decodeSignal, awaitSignal } = await import("../lib/signals.js");

function jcs(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${jcs(value[k])}`).join(",")}}`;
}

function sign(data) {
  const sig = createHmac("sha256", process.env.CORTEX_NATS_HMAC).update(jcs(data)).digest("hex");
  return { data, sig };
}

test("signalSubject builds canonical subject and rejects bad input", () => {
  assert.equal(signalSubject("run-1", "approval"), "cortex.signals.run-1.approval");
  assert.throws(() => signalSubject("", "approval"));
  assert.throws(() => signalSubject("run", "a.b"));
});

test("decodeSignal returns inner data on valid HMAC", () => {
  const data = { runId: "r", signalName: "approval", decision: "approve", approver: "ops", ts: new Date().toISOString() };
  const env = sign(data);
  assert.deepEqual(decodeSignal(JSON.stringify(env)), data);
});

test("decodeSignal rejects bad HMAC", () => {
  const env = { data: { runId: "r", signalName: "approval" }, sig: "deadbeef" };
  assert.throws(() => decodeSignal(JSON.stringify(env)));
});

test("awaitSignal rejects on timeout and invokes alertFn", async () => {
  // Fake nc that returns a JetStream stack producing an empty fetch + empty consume.
  const emptyIter = { async *[Symbol.asyncIterator]() {} };
  const consumer = {
    fetch: async () => emptyIter,
    consume: async () => emptyIter,
  };
  const jsm = {
    consumers: {
      add: async () => ({ name: "eph-1" }),
      delete: async () => ({}),
    },
  };
  const js = { consumers: { get: async () => consumer } };
  const nc = {
    jetstreamManager: async () => jsm,
    jetstream: () => js,
  };
  let alertCalls = 0;
  const alertFn = async () => { alertCalls++; };

  const start = Date.now();
  await assert.rejects(
    awaitSignal({ nc, runId: "rt", signalName: "approval", timeoutSec: 0.05, alertFn }),
    /timed out/,
  );
  const elapsed = Date.now() - start;
  assert.ok(elapsed >= 40, `expected >=40ms elapsed got ${elapsed}`);
  assert.equal(alertCalls, 1, "alertFn invoked once on timeout");
});

test("config declares CORTEX_SIGNALS with max_msgs_per_subject=1", async () => {
  const { readFileSync } = await import("node:fs");
  const cfg = JSON.parse(readFileSync(resolve(here, "../config.json"), "utf8"));
  const sig = (cfg.streams || []).find((s) => s.name === "CORTEX_SIGNALS");
  assert.ok(sig, "CORTEX_SIGNALS stream must be declared");
  assert.deepEqual(sig.subjects, ["cortex.signals.>"]);
  assert.equal(sig.max_msgs_per_subject, 1);
  assert.ok(cfg.approval_timeout_sec >= 60, "approval_timeout_sec must be set");
});

test("approval-required roster ships with at least one role", async () => {
  const { readFileSync } = await import("node:fs");
  const roster = JSON.parse(
    readFileSync(resolve(repoRoot, "templates/agent-roles/.approval-required.json"), "utf8"),
  );
  assert.ok(Array.isArray(roster) && roster.length > 0, "roster must list ≥1 role");
});
