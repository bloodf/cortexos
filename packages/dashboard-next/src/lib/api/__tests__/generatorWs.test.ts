// @vitest-environment jsdom
/**
 * P3.4 — generatorWs client unit tests.
 *
 * Mocks globalThis.WebSocket to assert the client's outbound protocol and
 * state transitions without opening a real socket. Asserts:
 *   1. URL defaults to `${proto}//${host}/agent-generator/ws` and respects override.
 *   2. open() transitions connecting → live on open; frames received from the
 *      fake server invoke the onFrame handler.
 *   3. send("hello") is coalesced + throttled (one frame per 200ms); the
 *      JSON envelope is {type:"user", text:"hello"}.
 *   4. sendPty sends {type:"input", data}; resizePty sends {type:"resize",…};
 *      build sends {type:"build"} (each only when state === "live").
 *   5. Auth closes (4401) transition to "unavailable" and stop reconnecting.
 *   6. close() is idempotent and suppresses reconnect.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeWS {
  static instances: FakeWS[] = [];
  static OPEN = 1;
  static CLOSED = 3;
  readyState = 0; // CONNECTING
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    FakeWS.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code = 1000, reason = "") {
    this.readyState = FakeWS.CLOSED;
    this.onclose?.({ code, reason });
  }
  // helpers used by tests
  __open() {
    this.readyState = FakeWS.OPEN;
    this.onopen?.(new Event("open"));
  }
  __message(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
  __authClose(code: number) {
    this.close(code, "");
  }
}

beforeEach(() => {
  FakeWS.instances = [];
  globalThis.WebSocket = FakeWS as unknown as typeof WebSocket;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("generatorWsUrl", () => {
  it("builds the same-origin /agent-generator/ws URL", async () => {
    const { generatorWsUrl } = await import("@/lib/api/generatorWs");
    expect(generatorWsUrl()).toBe(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/agent-generator/ws`);
  });
});

describe("openGeneratorWs", () => {
  it("transitions connecting → live on open and forwards inbound frames", async () => {
    const { openGeneratorWs } = await import("@/lib/api/generatorWs");
    const states: string[] = [];
    const frames: unknown[] = [];
    const session = openGeneratorWs({
      onState: (s) => states.push(s),
      onFrame: (f) => frames.push(f),
    });
    expect(session.state).toBe("connecting");
    expect(FakeWS.instances).toHaveLength(1);
    const sock = FakeWS.instances[0]!;
    sock.__open();
    expect(session.state).toBe("live");
    expect(states).toEqual(["connecting", "live"]);

    sock.__message({ type: "chat", role: "assistant", delta: "hi " });
    sock.__message({ type: "advisor", model: "x", delta: "adv " });
    sock.__message({ type: "skeptic", model: "y", delta: "skep " });
    sock.__message({ type: "pty", data: "$ " });
    sock.__message({ type: "status", status: "idle" });
    expect(frames).toHaveLength(5);
    session.close();
  });

  it("coalesces send() into one {type:'user', text} frame per throttle window", async () => {
    vi.useFakeTimers();
    const { openGeneratorWs } = await import("@/lib/api/generatorWs");
    const session = openGeneratorWs({ onFrame: () => {} });
    FakeWS.instances[0]!.__open();
    session.send("hello");
    session.send("world");
    expect(FakeWS.instances[0]!.sent).toEqual([]);
    vi.advanceTimersByTime(250);
    expect(FakeWS.instances[0]!.sent).toEqual([JSON.stringify({ type: "user", text: "world" })]);
    session.close();
  });
  it("serializes attachments into the user frame", async () => {
    vi.useFakeTimers();
    const { openGeneratorWs } = await import("@/lib/api/generatorWs");
    const session = openGeneratorWs({ onFrame: () => {} });
    FakeWS.instances[0]!.__open();
    session.send("see attached", {
      model: "cx/claude-opus-4-8",
      attachments: [{ filename: "diagram.png", mime: "image/png", dataBase64: "AAAA" }],
    });
    vi.advanceTimersByTime(250);
    expect(FakeWS.instances[0]!.sent).toEqual([
      JSON.stringify({
        type: "user",
        text: "see attached",
        model: "cx/claude-opus-4-8",
        attachments: [{ filename: "diagram.png", mime: "image/png", dataBase64: "AAAA" }],
      }),
    ]);
    session.close();
  });


  it("sendPty/resizePty/build only emit when state === 'live'", async () => {
    const { openGeneratorWs } = await import("@/lib/api/generatorWs");
    const session = openGeneratorWs({ onFrame: () => {} });
    // Still connecting — frames should be dropped silently.
    session.sendPty("x");
    session.resizePty(120, 30);
    session.build();
    expect(FakeWS.instances[0]!.sent).toEqual([]);
    FakeWS.instances[0]!.__open();
    session.sendPty("x");
    session.resizePty(120, 30);
    session.build();
    expect(FakeWS.instances[0]!.sent).toEqual([
      JSON.stringify({ type: "input", data: "x" }),
      JSON.stringify({ type: "resize", cols: 120, rows: 30 }),
      JSON.stringify({ type: "build" }),
    ]);
    session.close();
  });

  it("transitions to 'unavailable' on auth close (4401) and stops reconnecting", async () => {
    vi.useFakeTimers();
    const { openGeneratorWs } = await import("@/lib/api/generatorWs");
    const session = openGeneratorWs({ onFrame: () => {} });
    FakeWS.instances[0]!.__open();
    FakeWS.instances[0]!.__authClose(4401);
    expect(session.state).toBe("unavailable");
    vi.advanceTimersByTime(20_000);
    expect(FakeWS.instances).toHaveLength(1); // no reconnect
    session.close();
  });

  it("close() is idempotent and suppresses reconnect on transport close", async () => {
    vi.useFakeTimers();
    const { openGeneratorWs } = await import("@/lib/api/generatorWs");
    const session = openGeneratorWs({ onFrame: () => {} });
    FakeWS.instances[0]!.__open();
    session.close();
    session.close(); // idempotent
    FakeWS.instances[0]!.close(1006, "abnormal");
    vi.advanceTimersByTime(20_000);
    expect(FakeWS.instances).toHaveLength(1);
  });
});
