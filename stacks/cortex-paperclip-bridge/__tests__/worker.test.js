import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signEnvelope } from "../lib/nats-publisher.js";

const updateStatusMock = vi.fn();
vi.mock("../lib/idempotency.js", () => ({
  updateStatus: (...args) => updateStatusMock(...args),
}));

const HMAC = "test-hmac-secret";

beforeEach(() => {
  process.env.CORTEX_NATS_HMAC = HMAC;
  process.env.PAPERCLIP_API_URL = "http://paperclip.test";
  process.env.PAPERCLIP_API_KEY = "test-key";
  updateStatusMock.mockReset();
  updateStatusMock.mockResolvedValue(true);
});

afterEach(() => {
  vi.resetModules();
});

function buildEnvelope(overrides = {}) {
  const data = {
    runId: "run_1",
    issueId: "issue_1",
    status: "done",
    comment: "ok",
    costUsdCents: 42,
    ...overrides,
  };
  return signEnvelope(data, HMAC);
}

describe("handleStatusMessage", () => {
  it("issues PATCH with correct headers and body", async () => {
    const { handleStatusMessage } = await import("../worker.js");
    const patchIssue = vi.fn().mockResolvedValue({ ok: true, status: 200, body: {} });
    const client = { patchIssue };
    const env = buildEnvelope();
    await handleStatusMessage(env, client);
    expect(patchIssue).toHaveBeenCalledWith("issue_1", {
      status: "done",
      comment: "ok",
      costUsdCents: 42,
    }, "run_1");
    expect(updateStatusMock).toHaveBeenCalledWith("run_1", "done", 42);
  });

  it("rejects envelope with invalid HMAC", async () => {
    const { handleStatusMessage } = await import("../worker.js");
    const env = buildEnvelope();
    env.sig = "deadbeef";
    const client = { patchIssue: vi.fn() };
    await expect(handleStatusMessage(env, client)).rejects.toThrow(/hmac_invalid/);
  });

  it("throws on non-ok response so caller can retry", async () => {
    const { handleStatusMessage } = await import("../worker.js");
    const patchIssue = vi.fn().mockResolvedValue({ ok: false, status: 502, body: {} });
    await expect(handleStatusMessage(buildEnvelope(), { patchIssue })).rejects.toThrow(/paperclip_patch_failed/);
  });
});

describe("PaperclipClient", () => {
  it("constructs with required config and sets bearer + run-id headers", async () => {
    const { PaperclipClient } = await import("../lib/paperclip-client.js");
    const c = new PaperclipClient({ baseUrl: "http://x", token: "t" });
    const h = c.authHeaders("run_42");
    expect(h.Authorization).toBe("Bearer t");
    expect(h["X-Paperclip-Run-Id"]).toBe("run_42");
    expect(h["Content-Type"]).toBe("application/json");
  });

  it("omits run-id header when not provided", async () => {
    const { PaperclipClient } = await import("../lib/paperclip-client.js");
    const c = new PaperclipClient({ baseUrl: "http://x", token: "t" });
    const h = c.authHeaders();
    expect(h["X-Paperclip-Run-Id"]).toBeUndefined();
  });

  it("refuses construction without baseUrl or token", async () => {
    const { PaperclipClient } = await import("../lib/paperclip-client.js");
    expect(() => new PaperclipClient({ token: "t" })).toThrow();
    expect(() => new PaperclipClient({ baseUrl: "http://x" })).toThrow();
  });
});
