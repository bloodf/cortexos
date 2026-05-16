// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/db/chat-sessions", () => ({
	getChatSession: vi.fn(),
	upsertChatSession: vi.fn(),
}));

import { GET, PUT } from "../route";
import { requireAuth } from "@/lib/auth";
import { getChatSession, upsertChatSession } from "@/lib/db/chat-sessions";

const mockRequireAuth = vi.mocked(requireAuth);
const mockGet = vi.mocked(getChatSession);
const mockUpsert = vi.mocked(upsertChatSession);

const FAKE_SESSION = {
	user_id: 1,
	panel_open: true,
	width: 480,
	messages: [{ role: "user", content: "hi" }],
	updated_at: new Date(),
};

function authed(userId = 1) {
	return { error: null, session: { user_id: userId, username: "user1", token: "tok", is_admin: false } };
}
function unauthed() {
	return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }), session: null };
}

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
describe("GET /api/chat-sessions", () => {
	it("returns existing session", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockGet.mockResolvedValue(FAKE_SESSION as never);

		const res = await GET(new Request("http://localhost/api/chat-sessions"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.session.panel_open).toBe(true);
		expect(body.session.width).toBe(480);
	});

	it("returns default state when no session row exists", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockGet.mockResolvedValue(null);

		const res = await GET(new Request("http://localhost/api/chat-sessions"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.session.panel_open).toBe(false);
		expect(body.session.width).toBe(360);
		expect(body.session.messages).toEqual([]);
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthed());
		const res = await GET(new Request("http://localhost/api/chat-sessions"));
		expect(res.status).toBe(401);
	});

	it("returns 500 on DB error", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockGet.mockRejectedValue(new Error("DB down"));
		const res = await GET(new Request("http://localhost/api/chat-sessions"));
		expect(res.status).toBe(500);
	});
});

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------
describe("PUT /api/chat-sessions", () => {
	it("upserts panel_open", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockUpsert.mockResolvedValue({ ...FAKE_SESSION, panel_open: false } as never);

		const res = await PUT(new Request("http://localhost/api/chat-sessions", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ panel_open: false }),
		}));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.session.panel_open).toBe(false);
		expect(mockUpsert).toHaveBeenCalledWith(1, { panel_open: false });
	});

	it("upserts width", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockUpsert.mockResolvedValue({ ...FAKE_SESSION, width: 600 } as never);

		const res = await PUT(new Request("http://localhost/api/chat-sessions", {
			method: "PUT",
			body: JSON.stringify({ width: 600 }),
		}));
		expect(res.status).toBe(200);
		expect(mockUpsert).toHaveBeenCalledWith(1, { width: 600 });
	});

	it("upserts messages", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const msgs = [{ role: "assistant", content: "hello" }];
		mockUpsert.mockResolvedValue({ ...FAKE_SESSION, messages: msgs } as never);

		const res = await PUT(new Request("http://localhost/api/chat-sessions", {
			method: "PUT",
			body: JSON.stringify({ messages: msgs }),
		}));
		expect(res.status).toBe(200);
		expect(mockUpsert).toHaveBeenCalledWith(1, { messages: msgs });
	});

	it("returns 400 when panel_open is not boolean", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const res = await PUT(new Request("http://localhost/api/chat-sessions", {
			method: "PUT",
			body: JSON.stringify({ panel_open: "yes" }),
		}));
		expect(res.status).toBe(400);
	});

	it("returns 400 when width is not number", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const res = await PUT(new Request("http://localhost/api/chat-sessions", {
			method: "PUT",
			body: JSON.stringify({ width: "wide" }),
		}));
		expect(res.status).toBe(400);
	});

	it("returns 400 when messages is not array", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const res = await PUT(new Request("http://localhost/api/chat-sessions", {
			method: "PUT",
			body: JSON.stringify({ messages: "not-array" }),
		}));
		expect(res.status).toBe(400);
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthed());
		const res = await PUT(new Request("http://localhost/api/chat-sessions", {
			method: "PUT",
			body: JSON.stringify({ panel_open: true }),
		}));
		expect(res.status).toBe(401);
	});

	it("returns 500 on DB error", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockUpsert.mockRejectedValue(new Error("DB down"));
		const res = await PUT(new Request("http://localhost/api/chat-sessions", {
			method: "PUT",
			body: JSON.stringify({ panel_open: true }),
		}));
		expect(res.status).toBe(500);
	});
});
