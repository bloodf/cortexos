// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => {
	const fn = vi.fn();
	return { requireAuth: fn, requireAdmin: fn };
});
vi.mock("@/lib/db/dashboard-audit", () => ({
	insertAuditRow: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/db/chat-sessions", () => ({
	appendChatMessages: vi.fn().mockResolvedValue({}),
}));

// streamText mock returns an object exposing toUIMessageStreamResponse().
const fakeStreamResponse = new Response("stream-body", { status: 200 });
const streamTextMock = vi.fn((_args: unknown) => ({
	toUIMessageStreamResponse: () => fakeStreamResponse,
}));
vi.mock("ai", () => ({
	streamText: (args: unknown) => streamTextMock(args),
}));

vi.mock("@/lib/ai/provider-resolver", () => ({
	getNineRouterModel: vi.fn(() => ({ id: "stub-model" })),
	AIProviderConfigError: class AIProviderConfigError extends Error {},
}));
vi.mock("@/lib/ai/tools", () => ({
	getAllTools: vi.fn(() => ({})),
}));

import { POST } from "../route";
import { requireAuth } from "@/lib/auth";
import { insertAuditRow } from "@/lib/db/dashboard-audit";

const mockRequireAuth = vi.mocked(requireAuth);
const mockAudit = vi.mocked(insertAuditRow);

function authed(userId = 1) {
	return {
		error: null,
		session: { user_id: userId, username: "admin", token: "tok", is_admin: true },
	};
}
function unauthed() {
	return {
		error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
		session: null,
	};
}

function makeReq(body: unknown) {
	return new Request("http://localhost/api/ai/chat", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	delete process.env.NINEROUTER_BASE_URL;
	delete process.env.NINEROUTER_API_KEY;
});

const validBody = {
	sessionId: "s-1",
	messages: [{ role: "user", content: "hi" }],
};

describe("POST /api/ai/chat", () => {
	it("401 + deny audit when unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthed());
		const res = await POST(makeReq(validBody));
		expect(res.status).toBe(401);
		expect(mockAudit).toHaveBeenCalled();
		expect(mockAudit.mock.calls[0][0].decision).toBe("deny");
	});

	it("400 on malformed body", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const res = await POST(
			new Request("http://localhost/api/ai/chat", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "not-json",
			}),
		);
		expect(res.status).toBe(400);
	});

	it("400 on schema-invalid body (missing sessionId)", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const res = await POST(makeReq({ messages: [{ role: "user", content: "x" }] }));
		expect(res.status).toBe(400);
	});

	it("503 when provider env unset", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const res = await POST(makeReq(validBody));
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body.code).toBe("ENOPROVIDER");
	});

	it("streams when configured", async () => {
		mockRequireAuth.mockResolvedValue(authed(10));
		process.env.NINEROUTER_BASE_URL = "http://nr.local";
		process.env.NINEROUTER_API_KEY = "k";
		const res = await POST(makeReq(validBody));
		expect(res.status).toBe(200);
		expect(streamTextMock).toHaveBeenCalledOnce();
	});

	it("429 with Retry-After header when rate-limit exhausted", async () => {
		mockRequireAuth.mockResolvedValue(authed(999));
		process.env.NINEROUTER_BASE_URL = "http://nr.local";
		process.env.NINEROUTER_API_KEY = "k";
		for (let i = 0; i < 60; i++) {
			await POST(makeReq(validBody));
		}
		const res = await POST(makeReq(validBody));
		expect(res.status).toBe(429);
		expect(res.headers.get("retry-after")).toBeTruthy();
	});
});
