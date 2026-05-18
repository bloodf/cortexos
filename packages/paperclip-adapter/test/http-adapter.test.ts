import { describe, it, expect } from "vitest";
import { HttpAdapter } from "../src/http-adapter.js";

describe("HttpAdapter.register", () => {
  it("returns a frozen config payload with defaults", () => {
    const fixedNow = new Date("2026-05-18T12:00:00.000Z");
    const adapter = new HttpAdapter({ now: () => fixedNow });
    const cfg = adapter.register("planner", "https://example.com/hook", "s3cret");

    expect(cfg.kind).toBe("http");
    expect(cfg.role).toBe("planner");
    expect(cfg.webhookUrl).toBe("https://example.com/hook");
    expect(cfg.secret).toBe("s3cret");
    expect(cfg.events).toEqual(["issue.created", "issue.updated", "issue.assigned"]);
    expect(cfg.registeredAt).toBe(fixedNow.toISOString());
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  it("accepts custom default events at construction", () => {
    const adapter = new HttpAdapter({ defaultEvents: ["custom.event"] });
    const cfg = adapter.register("r", "http://localhost:8080/h", "x");
    expect(cfg.events).toEqual(["custom.event"]);
  });

  it("accepts per-call events override", () => {
    const adapter = new HttpAdapter();
    const cfg = adapter.register("r", "https://x/y", "x", ["only.this"]);
    expect(cfg.events).toEqual(["only.this"]);
  });

  it("throws when role is empty", () => {
    const adapter = new HttpAdapter();
    expect(() => adapter.register("", "https://x", "y")).toThrow(/role/);
  });

  it("throws when secret is empty", () => {
    const adapter = new HttpAdapter();
    expect(() => adapter.register("r", "https://x", "")).toThrow(/secret/);
  });

  it("throws when webhookUrl is empty", () => {
    const adapter = new HttpAdapter();
    expect(() => adapter.register("r", "", "y")).toThrow(/webhookUrl/);
  });

  it("throws when webhookUrl is malformed", () => {
    const adapter = new HttpAdapter();
    expect(() => adapter.register("r", "not-a-url", "y")).toThrow(/valid URL/);
  });

  it("throws when webhookUrl uses non-http scheme", () => {
    const adapter = new HttpAdapter();
    expect(() => adapter.register("r", "ftp://x/y", "y")).toThrow(/protocol/);
  });

  it("accepts http and https URLs", () => {
    const a = new HttpAdapter();
    expect(a.register("r", "http://a/b", "s").webhookUrl).toBe("http://a/b");
    expect(a.register("r", "https://a/b", "s").webhookUrl).toBe("https://a/b");
  });

  it("uses real Date when now is not injected", () => {
    const adapter = new HttpAdapter();
    const before = Date.now();
    const cfg = adapter.register("r", "https://x", "y");
    const ts = Date.parse(cfg.registeredAt);
    expect(ts).toBeGreaterThanOrEqual(before - 1);
  });
});
