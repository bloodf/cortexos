import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { instrument, traceLLMCall, shutdown, __resetForTests, __getConfigForTests } from "../src/index.js";

const ENV_KEYS = [
  "LANGFUSE_HOST",
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_SECRET_KEY",
  "CORTEX_TELEMETRY_SERVICE",
  "CORTEX_TELEMETRY_ENV",
  "CORTEX_TELEMETRY_DISABLED",
  "NODE_ENV",
];

let savedEnv;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  __resetForTests();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  __resetForTests();
});

describe("instrument()", () => {
  it("no-ops when LANGFUSE_HOST is unset", () => {
    const res = instrument({ service: "test" });
    expect(res.enabled).toBe(false);
    expect(res.service).toBe("test");
  });

  it("no-ops when CORTEX_TELEMETRY_DISABLED=1 even with creds set", () => {
    process.env.LANGFUSE_HOST = "http://lf";
    process.env.LANGFUSE_PUBLIC_KEY = "pk";
    process.env.LANGFUSE_SECRET_KEY = "sk";
    process.env.CORTEX_TELEMETRY_DISABLED = "1";
    const res = instrument();
    expect(res.enabled).toBe(false);
  });

  it("is idempotent — second call returns same status without re-init", () => {
    const a = instrument({ service: "svc-a" });
    const b = instrument({ service: "svc-b" });
    expect(a.enabled).toBe(false);
    expect(b.enabled).toBe(false);
    // service from first call wins
    expect(__getConfigForTests().service).toBe("svc-a");
  });

  it("defaults service from CORTEX_TELEMETRY_SERVICE env when no opt given", () => {
    process.env.CORTEX_TELEMETRY_SERVICE = "env-service";
    const res = instrument();
    expect(res.service).toBe("env-service");
  });

  it("defaults env to NODE_ENV when not provided", () => {
    process.env.NODE_ENV = "staging";
    instrument();
    expect(__getConfigForTests().env).toBe("staging");
  });
});

describe("traceLLMCall()", () => {
  it("runs the handler when telemetry is disabled", async () => {
    const fn = vi.fn().mockResolvedValue({ text: "hello" });
    const result = await traceLLMCall({ name: "test.call" }, fn);
    expect(fn).toHaveBeenCalledOnce();
    expect(result).toEqual({ text: "hello" });
  });

  it("propagates handler errors when telemetry is disabled", async () => {
    const err = new Error("boom");
    await expect(traceLLMCall({ name: "x" }, async () => { throw err; })).rejects.toBe(err);
  });

  it("rejects non-function handlers", async () => {
    await expect(traceLLMCall({ name: "x" }, /** @type any */ (null))).rejects.toThrow(/handler must be a function/);
  });

  it("auto-initialises on first call when instrument() not invoked", async () => {
    __resetForTests();
    const fn = vi.fn().mockResolvedValue(42);
    await traceLLMCall({ name: "auto" }, fn);
    expect(__getConfigForTests()).not.toBeNull();
  });
});

describe("shutdown()", () => {
  it("is safe to call when telemetry never initialised", async () => {
    await expect(shutdown()).resolves.toBeUndefined();
  });

  it("is safe to call after a no-op instrument()", async () => {
    instrument();
    await expect(shutdown()).resolves.toBeUndefined();
  });
});
