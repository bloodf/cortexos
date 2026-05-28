import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function load() {
  return await import("../alerts");
}

describe("buildSubject", () => {
  it("composes valid subjects", async () => {
    const { buildSubject } = await load();
    expect(buildSubject("critical", "bridge")).toBe(
      "dashboard.alerts.critical.bridge",
    );
    expect(buildSubject("info", "dashboard.api")).toBe(
      "dashboard.alerts.info.dashboard.api",
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

describe("publishAlert", () => {
  it("records a dashboard-local alert and writes a structured log line", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const { publishAlert } = await load();
    const r = await publishAlert({
      title: "x",
      severity: "critical",
      source: "test",
      timestamp: "2026-01-01T00:00:00Z",
    });
    expect(r.published).toBe(true);
    expect(r.subject).toBe("dashboard.alerts.critical.test");
    expect(r.reason).toBeUndefined();
    expect(r.id).toMatch(/^[a-f0-9]{24}$/);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const line = String(writeSpy.mock.calls[0][0]);
    const logged = JSON.parse(line);
    expect(logged.event).toBe("dashboard.alert");
    expect(logged.subject).toBe("dashboard.alerts.critical.test");
    expect(logged.id).toBe(r.id);
  });

  it("routes to per-severity subject", async () => {
    const { publishAlert } = await load();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const subjects: string[] = [];
    for (const sev of ["info", "warning", "critical"] as const) {
      const r = await publishAlert({
        title: "t",
        severity: sev,
        source: "s",
        timestamp: "2026-01-01T00:00:00Z",
      });
      subjects.push(r.subject);
    }
    expect(subjects).toEqual([
      "dashboard.alerts.info.s",
      "dashboard.alerts.warning.s",
      "dashboard.alerts.critical.s",
    ]);
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
});
