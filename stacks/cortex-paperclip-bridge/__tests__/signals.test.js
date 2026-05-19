import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signEnvelope } from "../lib/nats-publisher.js";

const HMAC = "test-hmac-secret-signals";

beforeEach(() => {
  process.env.CORTEX_NATS_HMAC = HMAC;
});

afterEach(() => {
  vi.resetModules();
  vi.useRealTimers();
});

function makeMessage(data) {
  const env = signEnvelope(data, HMAC);
  const json = JSON.stringify(env);
  return {
    data: new TextEncoder().encode(json),
    ack: vi.fn(),
  };
}

async function loadSignals() {
  return await import("../lib/signals.js");
}

function buildMockNats({ messages = [], streamExists = true } = {}) {
  // Async iterable that yields each message once then completes.
  const makeIter = (arr) => ({
    async *[Symbol.asyncIterator]() {
      for (const m of arr) yield m;
    },
  });

  let consumerCount = 0;
  const consumer = {
    fetch: vi.fn(async () => makeIter(messages.splice(0, 1))),
    consume: vi.fn(async () => makeIter(messages.splice(0, messages.length))),
  };

  const jsm = {
    streams: {
      info: vi.fn(async () => {
        if (!streamExists) throw new Error("no stream");
        return { config: { name: "CORTEX_SIGNALS" } };
      }),
      update: vi.fn(async () => ({})),
      add: vi.fn(async () => ({})),
    },
    consumers: {
      add: vi.fn(async () => {
        consumerCount++;
        return { name: `eph-${consumerCount}` };
      }),
      delete: vi.fn(async () => ({})),
    },
  };

  const js = {
    consumers: {
      get: vi.fn(async () => consumer),
    },
  };

  const nc = {
    jetstreamManager: vi.fn(async () => jsm),
    jetstream: vi.fn(() => js),
    isClosed: () => false,
  };

  return { nc, jsm, js, consumer };
}

describe("signalSubject", () => {
  it("builds canonical subject", async () => {
    const { signalSubject } = await loadSignals();
    expect(signalSubject("run-123", "approval")).toBe("cortex.signals.run-123.approval");
  });

  it("rejects subject chars in runId or signalName", async () => {
    const { signalSubject } = await loadSignals();
    expect(() => signalSubject("run.123", "approval")).toThrow();
    expect(() => signalSubject("run", "a.b")).toThrow();
    expect(() => signalSubject("", "approval")).toThrow();
  });
});

describe("decodeSignal", () => {
  it("decodes a signed legacy payload", async () => {
    const { decodeSignal } = await loadSignals();
    const payload = {
      runId: "r1",
      signalName: "approval",
      decision: "approve",
      approver: "admin",
      ts: new Date().toISOString(),
    };
    const env = signEnvelope(payload, HMAC);
    const decoded = decodeSignal(JSON.stringify(env));
    expect(decoded).toEqual(payload);
  });

  it("decodes a CloudEvents-wrapped payload", async () => {
    const { decodeSignal } = await loadSignals();
    const data = {
      runId: "r2",
      signalName: "approval",
      decision: "deny",
      approver: "ops",
      ts: new Date().toISOString(),
    };
    const ce = {
      specversion: "1.0",
      id: "abc",
      type: "cortex.signal.approval.r2.v1",
      source: "test",
      data,
    };
    const env = signEnvelope(ce, HMAC);
    const decoded = decodeSignal(JSON.stringify(env));
    expect(decoded).toEqual(data);
  });

  it("rejects invalid HMAC", async () => {
    const { decodeSignal } = await loadSignals();
    const env = signEnvelope({ runId: "r", signalName: "s" }, "wrong-secret");
    expect(() => decodeSignal(JSON.stringify(env))).toThrow(/HMAC/);
  });

  it("rejects shape mismatches", async () => {
    const { decodeSignal } = await loadSignals();
    expect(() => decodeSignal("not-json")).toThrow();
    expect(() => decodeSignal(JSON.stringify({ data: 1 }))).toThrow();
  });
});

describe("awaitSignal", () => {
  it("resolves on the first valid signal", async () => {
    const { awaitSignal } = await loadSignals();
    const payload = {
      runId: "run-A",
      signalName: "approval",
      decision: "approve",
      approver: "admin",
      ts: new Date().toISOString(),
    };
    const { nc } = buildMockNats({ messages: [makeMessage(payload)] });

    const decoded = await awaitSignal("run-A", "approval", 5, { nc, alertFn: vi.fn() });
    expect(decoded).toEqual(payload);
  });

  it("rejects on timeout and publishes approval-timeout alert", async () => {
    const { awaitSignal } = await loadSignals();
    const { nc } = buildMockNats({ messages: [] });
    const alertFn = vi.fn().mockResolvedValue(undefined);

    const start = Date.now();
    await expect(
      awaitSignal("run-T", "approval", 0.05, { nc, alertFn }),
    ).rejects.toThrow(/timed out/);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);

    expect(alertFn).toHaveBeenCalledTimes(1);
    expect(alertFn).toHaveBeenCalledWith({
      runId: "run-T",
      signalName: "approval",
      timeoutSec: 0.05,
    });
  });

  it("rejects invalid timeoutSec", async () => {
    const { awaitSignal } = await loadSignals();
    const { nc } = buildMockNats();
    await expect(awaitSignal("r", "s", 0, { nc })).rejects.toThrow(/timeoutSec/);
  });

  it("creates the stream when missing", async () => {
    const { awaitSignal } = await loadSignals();
    const { nc, jsm } = buildMockNats({ streamExists: false, messages: [] });
    const alertFn = vi.fn();
    await expect(
      awaitSignal("run-X", "approval", 0.05, { nc, alertFn }),
    ).rejects.toThrow(/timed out/);
    expect(jsm.streams.add).toHaveBeenCalled();
  });
});
