// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => {
	const fn = vi.fn();
	return { requireAuth: fn, requireAdmin: fn };
});
vi.mock("@/lib/db/agent-gateway-audit", () => ({
	listAudit: vi.fn(),
	countAudit: vi.fn(),
}));

import { GET } from "../route";
import { requireAdmin } from "@/lib/auth";
import { listAudit, countAudit } from "@/lib/db/agent-gateway-audit";

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockListAudit = vi.mocked(listAudit);
const mockCountAudit = vi.mocked(countAudit);

function authed() {
	return { error: null, session: { user_id: 1, username: "admin", token: "tok", is_admin: true } };
}
function unauthed() {
	return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }), session: null };
}

const FAKE_ROW = {
	id: 1,
	ts: new Date("2026-01-01"),
	actor_user_id: 1,
	tool: "env.read",
	tool_class: "privileged",
	args_hash: "abc",
	decision: "allow",
	result: "ok",
};

beforeEach(() => {
	vi.clearAllMocks();
	mockCountAudit.mockResolvedValue(0);
});

describe("GET /api/audit", () => {
	it("returns audit rows for authed admin", async () => {
		mockRequireAdmin.mockResolvedValue(authed());
		mockListAudit.mockResolvedValue([FAKE_ROW] as never);
		mockCountAudit.mockResolvedValue(1);

		const res = await GET(new Request("http://localhost/api/audit"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.rows).toHaveLength(1);
		expect(body.limit).toBe(100);
		expect(body.offset).toBe(0);
		expect(body.total).toBe(1);
		expect(body.hasMore).toBe(false);
	});

	it("passes filters to listAudit", async () => {
		mockRequireAdmin.mockResolvedValue(authed());
		mockListAudit.mockResolvedValue([]);

		const url = "http://localhost/api/audit?tool=env.read&tool_class=privileged&decision=allow&limit=50&offset=0";
		await GET(new Request(url));

		expect(mockListAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				tool: "env.read",
				tool_class: "privileged",
				decision: "allow",
				limit: 50,
				offset: 0,
			}),
		);
	});

	it("caps limit at 1000", async () => {
		mockRequireAdmin.mockResolvedValue(authed());
		mockListAudit.mockResolvedValue([]);

		await GET(new Request("http://localhost/api/audit?limit=9999"));
		expect(mockListAudit.mock.calls.at(0)?.[0]?.limit).toBe(1000);
	});

	it("defaults limit to 100", async () => {
		mockRequireAdmin.mockResolvedValue(authed());
		mockListAudit.mockResolvedValue([]);

		await GET(new Request("http://localhost/api/audit"));
		expect(mockListAudit.mock.calls.at(0)?.[0]?.limit).toBe(100);
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAdmin.mockResolvedValue(unauthed());
		const res = await GET(new Request("http://localhost/api/audit"));
		expect(res.status).toBe(401);
	});

	it("returns 400 for invalid filter enum", async () => {
		mockRequireAdmin.mockResolvedValue(authed());

		const res = await GET(new Request("http://localhost/api/audit?tool_class=bogus"));
		expect(res.status).toBe(400);
	});

	it("returns 400 for malformed date", async () => {
		mockRequireAdmin.mockResolvedValue(authed());

		const res = await GET(new Request("http://localhost/api/audit?from=notadate"));
		expect(res.status).toBe(400);
	});

	it("pushes offset into listAudit query", async () => {
		mockRequireAdmin.mockResolvedValue(authed());
		mockListAudit.mockResolvedValue([{ ...FAKE_ROW, id: 2 }] as never);
		mockCountAudit.mockResolvedValue(2);

		const res = await GET(new Request("http://localhost/api/audit?offset=1"));
		const body = await res.json();
		expect(body.rows).toHaveLength(1);
		expect(body.rows[0].id).toBe(2);
		expect(body.offset).toBe(1);
		expect(body.hasMore).toBe(false);
		expect(mockListAudit.mock.calls.at(0)?.[0]?.offset).toBe(1);
	});

	it("never returns raw error messages on 500", async () => {
		mockRequireAdmin.mockResolvedValue(authed());
		mockListAudit.mockRejectedValue(new Error("pg internal: leaky context"));

		const res = await GET(new Request("http://localhost/api/audit"));
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.error).not.toContain("pg internal");
	});
});
