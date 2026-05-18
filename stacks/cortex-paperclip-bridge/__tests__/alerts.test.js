import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signEnvelope } from "../lib/nats-publisher.js";

const HMAC = "test-hmac-secret-alerts";

beforeEach(() => {
  process.env.CORTEX_NATS_HMAC = HMAC;
  process.env.PAPERCLIP_API_URL = "http://paperclip.test";
  process.env.PAPERCLIP_API_KEY = "test-key";
  delete process.env.BRIDGE_ALERTS_ENABLED;
  delete process.env.BRIDGE_ALERTS_DIGEST;
  delete process.env.BRIDGE_ALERTS_MIN_SEVERITY;
  delete process.env.BRIDGE_ALERTS_OPS_ISSUE_ID;
});

afterEach(() => {
  vi.resetModules();
});

function env(data) {
  return signEnvelope(data, HMAC);
}

async function loadLib() {
  return await import("../lib/alerts.js");
}

function buildDeps(overrides = {}) {
  return {
    config: {
      enabled: true,
      minSeverity: "warning",
      digestMode: false,
      paperclipUrl: "http://paperclip.test",
      paperclipToken: "tok",
      opsIssueId: "",
      ...(overrides.config || {}),
    },
    rateLimiter: overrides.rateLimiter || { allow: () => true },
    digest: overrides.digest || { add: vi.fn(), flush: vi.fn(), stop: vi.fn() },
    postFn: overrides.postFn || vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    fallbackFn: overrides.fallbackFn || vi.fn().mockResolvedValue({ ok: true, status: 201 }),
  };
}

describe("parseSubject", () => {
  it("parses valid subjects", async () => {
    const { parseSubject } = await loadLib();
    expect(parseSubject("cortex.alerts.critical.bridge")).toEqual({
      severity: "critical",
      source: "bridge",
    });
    expect(parseSubject("cortex.alerts.info.dashboard.service")).toEqual({
      severity: "info",
      source: "dashboard.service",
    });
  });

  it("rejects malformed subjects", async () => {
    const { parseSubject } = await loadLib();
    expect(parseSubject("cortex.alerts.bogus.x")).toBeNull();
    expect(parseSubject("cortex.alerts.critical")).toBeNull();
    expect(parseSubject("foo.alerts.info.bar")).toBeNull();
    expect(parseSubject("")).toBeNull();
  });
});

describe("createRateLimiter", () => {
  it("allows up to max per source, blocks the next", async () => {
    const { createRateLimiter } = await loadLib();
    let now = 1000;
    const rl = createRateLimiter({ max: 3, windowMs: 60_000, now: () => now });
    expect(rl.allow("svc")).toBe(true);
    expect(rl.allow("svc")).toBe(true);
    expect(rl.allow("svc")).toBe(true);
    expect(rl.allow("svc")).toBe(false);
    expect(rl.allow("other")).toBe(true);
  });

  it("recovers after window passes", async () => {
    const { createRateLimiter } = await loadLib();
    let now = 1000;
    const rl = createRateLimiter({ max: 1, windowMs: 100, now: () => now });
    expect(rl.allow("s")).toBe(true);
    expect(rl.allow("s")).toBe(false);
    now += 200;
    expect(rl.allow("s")).toBe(true);
  });
});

describe("handleAlertMessage", () => {
  it("happy path: posts to Paperclip", async () => {
    const { handleAlertMessage } = await loadLib();
    const postFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const deps = buildDeps({ postFn });
    const e = env({ title: "high CPU", body: "85%", timestamp: "2026-01-01T00:00:00Z" });
    const r = await handleAlertMessage({
      subject: "cortex.alerts.critical.cpu",
      envelope: e,
      deps,
    });
    expect(r.action).toBe("delivered");
    expect(postFn).toHaveBeenCalledTimes(1);
    const call = postFn.mock.calls[0][0];
    expect(call.body.severity).toBe("critical");
    expect(call.body.source).toBe("cpu");
    expect(call.body.title).toBe("high CPU");
    expect(call.body.timestamp).toBe("2026-01-01T00:00:00Z");
  });

  it("rejects invalid HMAC", async () => {
    const { handleAlertMessage } = await loadLib();
    const e = env({ title: "x" });
    e.sig = "deadbeef";
    await expect(
      handleAlertMessage({ subject: "cortex.alerts.warning.x", envelope: e, deps: buildDeps() }),
    ).rejects.toThrow(/hmac_invalid/);
  });

  it("severity gate drops info when minSeverity=warning", async () => {
    const { handleAlertMessage } = await loadLib();
    const postFn = vi.fn();
    const deps = buildDeps({ postFn, config: { minSeverity: "warning" } });
    const r = await handleAlertMessage({
      subject: "cortex.alerts.info.x",
      envelope: env({ title: "noise" }),
      deps,
    });
    expect(r.action).toBe("dropped_severity");
    expect(postFn).not.toHaveBeenCalled();
  });

  it("rate limiter drops once exceeded", async () => {
    const { handleAlertMessage } = await loadLib();
    const postFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    let allow = true;
    const deps = buildDeps({ postFn, rateLimiter: { allow: () => allow } });
    let r = await handleAlertMessage({
      subject: "cortex.alerts.critical.x",
      envelope: env({ title: "a" }),
      deps,
    });
    expect(r.action).toBe("delivered");
    allow = false;
    r = await handleAlertMessage({
      subject: "cortex.alerts.critical.x",
      envelope: env({ title: "b" }),
      deps,
    });
    expect(r.action).toBe("dropped_rate");
    expect(postFn).toHaveBeenCalledTimes(1);
  });

  it("kill switch (enabled=false) short-circuits", async () => {
    const { handleAlertMessage } = await loadLib();
    const postFn = vi.fn();
    const deps = buildDeps({ postFn, config: { enabled: false } });
    const r = await handleAlertMessage({
      subject: "cortex.alerts.critical.x",
      envelope: env({ title: "x" }),
      deps,
    });
    expect(r.action).toBe("disabled");
    expect(postFn).not.toHaveBeenCalled();
  });

  it("digest mode accumulates info alerts instead of posting", async () => {
    const { handleAlertMessage } = await loadLib();
    const postFn = vi.fn();
    const add = vi.fn();
    const deps = buildDeps({
      postFn,
      digest: { add, flush: vi.fn(), stop: vi.fn() },
      config: { digestMode: true, minSeverity: "info" },
    });
    await handleAlertMessage({
      subject: "cortex.alerts.info.svc",
      envelope: env({ title: "i1" }),
      deps,
    });
    await handleAlertMessage({
      subject: "cortex.alerts.info.svc",
      envelope: env({ title: "i2" }),
      deps,
    });
    expect(add).toHaveBeenCalledTimes(2);
    expect(postFn).not.toHaveBeenCalled();
  });

  it("404 from notifications triggers ops-issue fallback", async () => {
    const { handleAlertMessage } = await loadLib();
    const postFn = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const fallbackFn = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    const deps = buildDeps({
      postFn,
      fallbackFn,
      config: { opsIssueId: "ISSUE-99" },
    });
    const r = await handleAlertMessage({
      subject: "cortex.alerts.critical.bridge",
      envelope: env({ title: "boom" }),
      deps,
    });
    expect(r.action).toBe("fallback");
    expect(fallbackFn).toHaveBeenCalledTimes(1);
    expect(fallbackFn.mock.calls[0][0].opsIssueId).toBe("ISSUE-99");
  });

  it("non-ok non-404 response throws", async () => {
    const { handleAlertMessage } = await loadLib();
    const postFn = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const deps = buildDeps({ postFn });
    await expect(
      handleAlertMessage({
        subject: "cortex.alerts.critical.x",
        envelope: env({ title: "x" }),
        deps,
      }),
    ).rejects.toThrow(/paperclip_post_failed/);
  });
});

describe("loadConfig", () => {
  it("uses defaults when env unset", async () => {
    const { loadConfig } = await loadLib();
    const c = loadConfig({});
    expect(c.enabled).toBe(true);
    expect(c.minSeverity).toBe("warning");
    expect(c.digestMode).toBe(false);
  });

  it("respects env overrides", async () => {
    const { loadConfig } = await loadLib();
    const c = loadConfig({
      BRIDGE_ALERTS_ENABLED: "0",
      BRIDGE_ALERTS_MIN_SEVERITY: "info",
      BRIDGE_ALERTS_DIGEST: "1",
      PAPERCLIP_API_URL: "u",
      PAPERCLIP_API_KEY: "k",
      BRIDGE_ALERTS_OPS_ISSUE_ID: "ops",
    });
    expect(c.enabled).toBe(false);
    expect(c.minSeverity).toBe("info");
    expect(c.digestMode).toBe(true);
    expect(c.opsIssueId).toBe("ops");
  });

  it("ignores invalid severity, falls back to warning", async () => {
    const { loadConfig } = await loadLib();
    const c = loadConfig({ BRIDGE_ALERTS_MIN_SEVERITY: "bogus" });
    expect(c.minSeverity).toBe("warning");
  });
});

describe("createDigestBuffer", () => {
  it("flushes accumulated items via onFlush", async () => {
    const { createDigestBuffer } = await loadLib();
    const onFlush = vi.fn().mockResolvedValue(undefined);
    const intervals = [];
    const timers = {
      setInterval: (fn) => { intervals.push(fn); return { unref: () => {} }; },
      clearInterval: () => {},
    };
    const d = createDigestBuffer({ windowMs: 1000, onFlush, timers });
    d.add({ title: "a" });
    d.add({ title: "b" });
    await d.flush();
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0]).toHaveLength(2);
    // already-flushed, second flush no-ops
    await d.flush();
    expect(onFlush).toHaveBeenCalledTimes(1);
  });
});
