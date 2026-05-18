import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const publishAlertMock = vi.fn();
const requireAdminMock = vi.fn();

vi.mock("@/lib/alerts", () => ({
  publishAlert: (...args: unknown[]) => publishAlertMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

async function loadRoute() {
  return await import("../route");
}

beforeEach(() => {
  publishAlertMock.mockReset();
  requireAdminMock.mockReset();
  process.env.NATS_URL = "nats://127.0.0.1:4222";
  process.env.ADMIN_TOKEN = "admin-token-xyz";
  publishAlertMock.mockResolvedValue({
    published: true,
    subject: "cortex.alerts.critical.test",
  });
  requireAdminMock.mockResolvedValue({
    error: null,
    session: { user_id: 1, username: "admin", token: "t", is_admin: true },
  });
});

afterEach(() => {
  vi.resetModules();
});

function makeRequest({
  body,
  headers,
}: {
  body?: unknown;
  headers?: Record<string, string>;
} = {}): Request {
  return new Request("http://localhost/api/paperclip/notify-test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/paperclip/notify-test", () => {
  it("returns 503 when NATS_URL is unset", async () => {
    delete process.env.NATS_URL;
    const { POST } = await loadRoute();
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/NATS_URL/);
  });

  it("rejects when no admin session and no admin token header", async () => {
    requireAdminMock.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      }),
      session: null,
    });
    const { POST } = await loadRoute();
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    expect(publishAlertMock).not.toHaveBeenCalled();
  });

  it("allows access via X-Admin-Token header (no session check)", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ headers: { "x-admin-token": "admin-token-xyz" } }),
    );
    expect(res.status).toBe(200);
    expect(requireAdminMock).not.toHaveBeenCalled();
    expect(publishAlertMock).toHaveBeenCalledTimes(1);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.subject).toBe("cortex.alerts.critical.test");
    expect(typeof json.timestamp).toBe("string");
  });

  it("rejects wrong X-Admin-Token and falls back to session check", async () => {
    requireAdminMock.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
      session: null,
    });
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ headers: { "x-admin-token": "wrong" } }),
    );
    expect(res.status).toBe(401);
    expect(requireAdminMock).toHaveBeenCalledTimes(1);
  });

  it("happy path with admin session publishes synthetic critical alert", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeRequest({ body: { title: "hello" } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.subject).toBe("cortex.alerts.critical.test");
    expect(publishAlertMock).toHaveBeenCalledTimes(1);
    const arg = publishAlertMock.mock.calls[0][0];
    expect(arg.severity).toBe("critical");
    expect(arg.source).toBe("test");
    expect(arg.title).toBe("hello");
  });

  it("validates source pattern and falls back to 'test'", async () => {
    const { POST } = await loadRoute();
    await POST(makeRequest({ body: { source: "not valid!" } }));
    const arg = publishAlertMock.mock.calls[0][0];
    expect(arg.source).toBe("test");
  });

  it("accepts admin token even when ADMIN_TOKEN length differs", async () => {
    process.env.ADMIN_TOKEN = "short";
    const { POST } = await loadRoute();
    const res = await POST(
      makeRequest({ headers: { "x-admin-token": "different-length" } }),
    );
    // should NOT auth via header (mismatched lengths) so falls back to session
    expect(res.status).toBe(200);
    expect(requireAdminMock).toHaveBeenCalledTimes(1);
  });

  it("propagates publishAlert reason when published=false", async () => {
    publishAlertMock.mockResolvedValue({
      published: false,
      subject: "cortex.alerts.critical.test",
      reason: "no NATS client",
    });
    const { POST } = await loadRoute();
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.reason).toBe("no NATS client");
  });
});
