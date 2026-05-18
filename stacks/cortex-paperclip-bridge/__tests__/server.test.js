import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recordLinkMock = vi.fn();
const publishMock = vi.fn();

vi.mock("../lib/idempotency.js", () => ({
  recordLink: (...args) => recordLinkMock(...args),
}));
vi.mock("../lib/nats-publisher.js", () => ({
  publish: (...args) => publishMock(...args),
  getConnection: vi.fn().mockResolvedValue({}),
}));

const SECRET = "test-secret-32bytes-1234567890abc";

let app;

beforeEach(async () => {
  process.env.PAPERCLIP_WEBHOOK_SECRET = SECRET;
  process.env.CORTEX_OS_FAMILY = "debian";
  recordLinkMock.mockReset();
  publishMock.mockReset();
  recordLinkMock.mockResolvedValue({ inserted: true, id: 1 });
  publishMock.mockResolvedValue(undefined);
  const mod = await import("../server.js");
  app = mod.createApp();
});

afterEach(() => {
  vi.resetModules();
});

async function request(method, path, { auth, body } = {}) {
  const port = await new Promise((resolve) => {
    const srv = app.listen(0, () => resolve(srv.address().port));
  });
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* noop */ }
    return { status: res.status, json };
  } finally {
    // server returned by app.listen is hidden; close via internal handle
  }
}

function validBody() {
  return {
    runId: "run_abc",
    agentId: "agent_xyz",
    cortexRole: "ENG-BACKEND",
    context: { taskId: "issue_1", wakeReason: "manual", commentId: null },
  };
}

describe("healthz", () => {
  it("returns ok with family", async () => {
    const res = await request("GET", "/healthz");
    expect(res.status).toBe(200);
    expect(res.json.status).toBe("ok");
    expect(res.json.family).toBe("debian");
  });
});

describe("bearer auth", () => {
  it("rejects missing auth", async () => {
    const res = await request("POST", "/paperclip/heartbeat", { body: validBody() });
    expect(res.status).toBe(401);
  });

  it("rejects wrong token", async () => {
    const res = await request("POST", "/paperclip/heartbeat", { auth: "wrong-secret", body: validBody() });
    expect(res.status).toBe(401);
  });

  it("rejects length-mismatched token", async () => {
    const res = await request("POST", "/paperclip/heartbeat", { auth: "short", body: validBody() });
    expect(res.status).toBe(401);
  });

  it("accepts correct token with 202", async () => {
    const res = await request("POST", "/paperclip/heartbeat", { auth: SECRET, body: validBody() });
    expect(res.status).toBe(202);
    expect(res.json).toEqual({ runId: "run_abc", status: "queued" });
  });
});

describe("validation", () => {
  it("requires cortexRole", async () => {
    const body = validBody();
    delete body.cortexRole;
    const res = await request("POST", "/paperclip/heartbeat", { auth: SECRET, body });
    expect(res.status).toBe(400);
  });

  it("requires context.taskId", async () => {
    const body = validBody();
    delete body.context.taskId;
    const res = await request("POST", "/paperclip/heartbeat", { auth: SECRET, body });
    expect(res.status).toBe(400);
  });

  it("publishes to role-scoped subject", async () => {
    await request("POST", "/paperclip/heartbeat", { auth: SECRET, body: validBody() });
    expect(publishMock).toHaveBeenCalledWith(
      "cortex.paperclip.work.ENG-BACKEND",
      expect.objectContaining({
        specversion: "1.0",
        type: "cortex.paperclip.work.ENG-BACKEND.v1",
        source: "cortex-paperclip-bridge",
        data: expect.objectContaining({ runId: "run_abc", role: "ENG-BACKEND" }),
      }),
    );
  });
});

describe("idempotency", () => {
  it("calls recordLink with run id", async () => {
    await request("POST", "/paperclip/heartbeat", { auth: SECRET, body: validBody() });
    expect(recordLinkMock).toHaveBeenCalledWith(expect.objectContaining({ runId: "run_abc" }));
  });

  it("replay flag set when insert returns inserted=false", async () => {
    recordLinkMock.mockResolvedValueOnce({ inserted: false, id: 1 });
    await request("POST", "/paperclip/heartbeat", { auth: SECRET, body: validBody() });
    expect(publishMock).toHaveBeenCalledWith(
      "cortex.paperclip.work.ENG-BACKEND",
      expect.objectContaining({ replay: true }),
    );
  });
});

describe("latency budget", () => {
  it("acks under 200ms", async () => {
    const start = performance.now();
    const res = await request("POST", "/paperclip/heartbeat", { auth: SECRET, body: validBody() });
    const elapsed = performance.now() - start;
    expect(res.status).toBe(202);
    expect(elapsed).toBeLessThan(200);
  });
});
