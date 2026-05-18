import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

const HMAC = "test-hmac-dashboard";

beforeEach(() => {
  process.env.CORTEX_NATS_HMAC = HMAC;
  delete process.env.NATS_URL;
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function load() {
  return await import("../alerts");
}

function jcs(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map(
      (k) =>
        `${JSON.stringify(k)}:${jcs((value as Record<string, unknown>)[k])}`,
    )
    .join(",")}}`;
}

describe("buildSubject", () => {
  it("composes valid subjects", async () => {
    const { buildSubject } = await load();
    expect(buildSubject("critical", "bridge")).toBe(
      "cortex.alerts.critical.bridge",
    );
    expect(buildSubject("info", "dashboard.api")).toBe(
      "cortex.alerts.info.dashboard.api",
    );
  });

  it("rejects invalid severity", async () => {
    const { buildSubject } = await load();
    expect(() =>
      // @ts-expect-error testing invalid input
      buildSubject("bogus", "x"),
    ).toThrow(/invalid severity/);
  });

  it("rejects invalid source", async () => {
    const { buildSubject } = await load();
    expect(() => buildSubject("info", "")).toThrow(/invalid source/);
    expect(() => buildSubject("info", "has space")).toThrow(/invalid source/);
  });
});

describe("signEnvelope", () => {
  it("produces stable HMAC signature using JCS over data", async () => {
    const { signEnvelope } = await load();
    const data = {
      title: "x",
      severity: "warning" as const,
      source: "svc",
      timestamp: "2026-01-01T00:00:00Z",
    };
    const env = signEnvelope(data);
    const expected = createHmac("sha256", HMAC).update(jcs(data)).digest("hex");
    expect(env.sig).toBe(expected);
    expect(env.data).toEqual(data);
  });

  it("throws when HMAC secret missing", async () => {
    delete process.env.CORTEX_NATS_HMAC;
    const { signEnvelope } = await load();
    expect(() =>
      signEnvelope({
        title: "x",
        severity: "info",
        source: "s",
        timestamp: "t",
      }),
    ).toThrow(/CORTEX_NATS_HMAC/);
  });
});

describe("publishAlert", () => {
  it("does NOT publish when NATS_URL is unset, returns reason", async () => {
    const { publishAlert } = await load();
    const r = await publishAlert({
      title: "x",
      severity: "critical",
      source: "test",
    });
    expect(r.published).toBe(false);
    expect(r.subject).toBe("cortex.alerts.critical.test");
    expect(r.reason).toMatch(/NATS_URL/);
  });

  it("publishes signed envelope to NATS when configured", async () => {
    process.env.NATS_URL = "nats://127.0.0.1:4222";
    const publishMock = vi.fn();
    const { publishAlert, setNatsClientForTesting } = await load();
    setNatsClientForTesting({
      publish: publishMock,
      isClosed: () => false,
    });

    const r = await publishAlert({
      title: "high cpu",
      body: "85%",
      severity: "critical",
      source: "cpu",
      timestamp: "2026-01-01T00:00:00Z",
    });

    expect(r.published).toBe(true);
    expect(r.subject).toBe("cortex.alerts.critical.cpu");
    expect(publishMock).toHaveBeenCalledTimes(1);
    const [subject, bytes] = publishMock.mock.calls[0];
    expect(subject).toBe("cortex.alerts.critical.cpu");
    const decoded = JSON.parse(new TextDecoder().decode(bytes));
    expect(decoded.data.title).toBe("high cpu");
    expect(decoded.data.severity).toBe("critical");
    expect(decoded.data.source).toBe("cpu");
    expect(typeof decoded.sig).toBe("string");
    expect(decoded.sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it("routes to per-severity subject", async () => {
    process.env.NATS_URL = "nats://127.0.0.1:4222";
    const publishMock = vi.fn();
    const { publishAlert, setNatsClientForTesting } = await load();
    setNatsClientForTesting({ publish: publishMock, isClosed: () => false });

    for (const sev of ["info", "warning", "critical"] as const) {
      await publishAlert({
        title: "t",
        severity: sev,
        source: "s",
        timestamp: "2026-01-01T00:00:00Z",
      });
    }
    expect(publishMock.mock.calls.map((c) => c[0])).toEqual([
      "cortex.alerts.info.s",
      "cortex.alerts.warning.s",
      "cortex.alerts.critical.s",
    ]);
  });

  it("returns reason and does not throw when HMAC missing even with NATS_URL", async () => {
    process.env.NATS_URL = "nats://127.0.0.1:4222";
    delete process.env.CORTEX_NATS_HMAC;
    const { publishAlert, setNatsClientForTesting } = await load();
    setNatsClientForTesting({ publish: vi.fn(), isClosed: () => false });
    const r = await publishAlert({
      title: "x",
      severity: "warning",
      source: "s",
    });
    expect(r.published).toBe(false);
    expect(r.reason).toMatch(/CORTEX_NATS_HMAC/);
  });

  it("rejects invalid severity at publish time", async () => {
    const { publishAlert } = await load();
    await expect(
      publishAlert({
        // @ts-expect-error testing invalid input
        severity: "bogus",
        title: "x",
        source: "s",
      }),
    ).rejects.toThrow(/invalid severity/);
  });

  it("swallows publish errors and returns reason", async () => {
    process.env.NATS_URL = "nats://127.0.0.1:4222";
    const { publishAlert, setNatsClientForTesting } = await load();
    setNatsClientForTesting({
      publish: () => {
        throw new Error("conn dead");
      },
      isClosed: () => false,
    });
    const r = await publishAlert({
      title: "x",
      severity: "critical",
      source: "s",
    });
    expect(r.published).toBe(false);
    expect(r.reason).toMatch(/conn dead/);
  });
});
