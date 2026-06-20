// @vitest-environment node
/**
 * P3 verify — generator WS sidecar.
 *
 * Import-level tests only (no real WS bind, no live 9router, no real PTY, no DB).
 * The sidecar gates `httpServer.listen(...)` on `isMain`, so importing the
 * module is safe in tests.
 *
 * Asserts:
 *   1. httpServer + wss are exported and real instances.
 *   2. send is a function (the WS frame emitter).
 *   3. abortHandshake writes a minimal HTTP/1.1 response to a fake socket.
 *   4. The shared session-auth helpers (checkOrigin, clientIp, parseCookies)
 *      satisfy the sidecar's contract (regression guard).
 */

import { describe, it, expect } from "vitest";
import { Duplex } from "node:stream";
import {
  httpServer,
  wss,
  send,
  abortHandshake,
  buildUserContent,
} from "./server.js";
import { checkOrigin, clientIp, parseCookies } from "@cortexos/session-auth";

class FakeSocket extends Duplex {
  constructor() {
    super();
    this.chunks = [];
    this.destroyed = false;
  }
  _read() {}
  _write(chunk, _enc, cb) {
    this.chunks.push(Buffer.from(chunk));
    cb();
  }
  destroy(err) {
    this.destroyed = true;
    super.destroy(err);
  }
  text() {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

describe("generator sidecar — module surface", () => {
  it("exports httpServer, wss, send, abortHandshake", () => {
    expect(httpServer).toBeTruthy();
    expect(wss).toBeTruthy();
    expect(typeof send).toBe("function");
    expect(typeof abortHandshake).toBe("function");
  });
});

describe("generator sidecar — abortHandshake", () => {
  it("writes a 401 HTTP response (missing cookie path)", () => {
    const sock = new FakeSocket();
    abortHandshake(sock, 401);
    const out = sock.text();
    expect(out).toMatch(/^HTTP\/1\.1 401 Unauthorized/);
    expect(out).toMatch(/Connection: close/);
    expect(sock.destroyed).toBe(true);
  });
  it("writes a 403 response (Origin rejection)", () => {
    const sock = new FakeSocket();
    abortHandshake(sock, 403);
    expect(sock.text()).toMatch(/^HTTP\/1\.1 403 Forbidden/);
  });
});
describe("buildUserContent", () => {
  it("returns plain string when no attachments", () => {
    expect(buildUserContent("hi", undefined)).toEqual({ userContent: "hi", fullText: "hi" });
  });
  it("converts an image attachment to a multimodal part and adds a manifest line", () => {
    const out = buildUserContent("see this", [
      { filename: "a.png", mime: "image/png", dataBase64: "AAAA" },
    ]);
    expect(Array.isArray(out.userContent)).toBe(true);
    expect(out.userContent).toEqual([
      { type: "text", text: "see this" },
      { type: "image", image: "data:image/png;base64,AAAA" },
    ]);
    expect(out.fullText).toMatch(/see this/);
    expect(out.fullText).toMatch(/a\.png \(image\/png, image\)/);
  });
  it("renders non-image attachments as a manifest line only", () => {
    const out = buildUserContent("q?", [
      { filename: "spec.pdf", mime: "application/pdf", dataBase64: "BBBB" },
    ]);
    expect(out.userContent).toBe("q?");
    expect(out.fullText).toMatch(/spec\.pdf \(application\/pdf, non-image/);
  });
  it("drops oversized attachments and notes them in the manifest", () => {
    const out = buildUserContent("x", [
      { filename: "huge.bin", mime: "application/octet-stream", dataBase64: "a".repeat(35_000_001) },
    ]);
    expect(out.userContent).toBe("x");
    expect(out.fullText).toMatch(/skipped \(exceeds 35M base64 chars/);
  });
  it("silently drops invalid entries and caps the list at 8", () => {
    const atts = [];
    for (let i = 0; i < 12; i += 1) {
      atts.push({ filename: `f${i}.png`, mime: "image/png", dataBase64: "x" });
    }
    atts.push(null);
    atts.push({ filename: "no-data.png", mime: "image/png", dataBase64: "" });
    const out = buildUserContent("hi", atts);
    expect(out.userContent).toHaveLength(1 + 8);
    expect(out.fullText).toMatch(/f7\.png \(image\/png, image\)/);
    expect(out.fullText).not.toMatch(/f8\.png/);
  });
});

describe("session-auth — Origin / IP helpers (regression guard for sidecar)", () => {
  it("rejects unparseable origin in same-origin mode", () => {
    expect(checkOrigin("not a url", "host:8443", undefined)).toBe(false);
  });
  it("accepts matching host in same-origin mode", () => {
    expect(checkOrigin("https://host:8443", "host:8443", undefined)).toBe(true);
  });
  it("requires exact origin match when allowedOrigin is concrete", () => {
    expect(checkOrigin("https://allowed.example", "h", "https://allowed.example")).toBe(true);
    expect(checkOrigin("https://other.example", "h", "https://allowed.example")).toBe(false);
  });
  it("clientIp honors X-Forwarded-For (first IP)", () => {
    expect(clientIp({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })).toBe("1.2.3.4");
  });
  it("clientIp accepts array-form x-forwarded-for", () => {
    expect(clientIp({ "x-forwarded-for": ["5.6.7.8"] })).toBe("5.6.7.8");
  });
  it("clientIp falls back to 127.0.0.1 (generator-only; terminal reads socket)", () => {
    expect(clientIp({})).toBe("127.0.0.1");
  });
  it("parseCookies decodes %20 and tolerates malformed %-escape", () => {
    expect(parseCookies("a=hello%20world; b=%ZZ")).toEqual({ a: "hello world", b: "%ZZ" });
  });
});
