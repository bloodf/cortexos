// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => {
	const fn = vi.fn();
	return { requireAuth: fn, requireAdmin: fn };
});
vi.mock("@/lib/db/projects", () => ({ getProject: vi.fn() }));
vi.mock("@/lib/db/messaging-routes", () => ({
	listRoutes: vi.fn(),
	addRoute: vi.fn(),
	removeRoute: vi.fn(),
}));
vi.mock("@/lib/db/tool-audit", () => ({
	insertAuditRow: vi.fn().mockResolvedValue({}),
}));

import { GET, POST, DELETE } from "../route";
import { requireAuth } from "@/lib/auth";
import { getProject } from "@/lib/db/projects";
import { listRoutes, addRoute, removeRoute } from "@/lib/db/messaging-routes";
import { insertAuditRow } from "@/lib/db/tool-audit";

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetProject = vi.mocked(getProject);
const mockListRoutes = vi.mocked(listRoutes);
const mockAddRoute = vi.mocked(addRoute);
const mockRemoveRoute = vi.mocked(removeRoute);
const mockInsertAuditRow = vi.mocked(insertAuditRow);

const FAKE_PROJECT = { id: 7, slug: "myproj", name: "My Project" };
const FAKE_ROUTE = { id: 1, project_id: 7, platform: "slack", account_ref: "C123", route_config: {}, approval_gates: [] };

function authed(userId = 1) {
	return { error: null, session: { user_id: userId, username: "admin", token: "tok", is_admin: true } };
}
function unauthed() {
	return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }), session: null };
}
function ctx(slug = "myproj") {
	return { params: Promise.resolve({ slug }) };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/projects/[slug]/routes", () => {
	it("lists routes for project", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockGetProject.mockResolvedValue(FAKE_PROJECT as never);
		mockListRoutes.mockResolvedValue([FAKE_ROUTE] as never);

		const res = await GET(new Request("http://localhost/api/projects/myproj/routes"), ctx());
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.routes).toHaveLength(1);
	});

	it("returns 404 when project not found", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockGetProject.mockResolvedValue(null);
		const res = await GET(new Request("http://localhost/api/projects/nope/routes"), ctx("nope"));
		expect(res.status).toBe(404);
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthed());
		const res = await GET(new Request("http://localhost/api/projects/myproj/routes"), ctx());
		expect(res.status).toBe(401);
	});
});

describe("POST /api/projects/[slug]/routes", () => {
	it("adds route and audits", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockGetProject.mockResolvedValue(FAKE_PROJECT as never);
		mockAddRoute.mockResolvedValue(FAKE_ROUTE as never);

		const res = await POST(
			new Request("http://localhost/api/projects/myproj/routes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ platform: "slack", account_ref: "C123" }),
			}),
			ctx(),
		);
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.route.platform).toBe("slack");
		expect(mockInsertAuditRow).toHaveBeenCalledOnce();
	});

	it("returns 400 for invalid platform", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockGetProject.mockResolvedValue(FAKE_PROJECT as never);

		const res = await POST(
			new Request("http://localhost/api/projects/myproj/routes", {
				method: "POST",
				body: JSON.stringify({ platform: "carrier-pigeon", account_ref: "x" }),
			}),
			ctx(),
		);
		expect(res.status).toBe(400);
	});

	it("returns 400 when account_ref missing", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockGetProject.mockResolvedValue(FAKE_PROJECT as never);

		const res = await POST(
			new Request("http://localhost/api/projects/myproj/routes", {
				method: "POST",
				body: JSON.stringify({ platform: "slack" }),
			}),
			ctx(),
		);
		expect(res.status).toBe(400);
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthed());
		const res = await POST(
			new Request("http://localhost/api/projects/myproj/routes", { method: "POST", body: "{}" }),
			ctx(),
		);
		expect(res.status).toBe(401);
	});
});

describe("DELETE /api/projects/[slug]/routes", () => {
	it("removes route and audits", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockRemoveRoute.mockResolvedValue(undefined);

		const res = await DELETE(
			new Request("http://localhost/api/projects/myproj/routes?id=1", { method: "DELETE" }),
			ctx(),
		);
		expect(res.status).toBe(200);
		expect(mockInsertAuditRow).toHaveBeenCalledOnce();
		expect(mockInsertAuditRow.mock.calls[0][0].tool).toBe("messaging_route.remove");
	});

	it("returns 400 when id missing", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const res = await DELETE(
			new Request("http://localhost/api/projects/myproj/routes", { method: "DELETE" }),
			ctx(),
		);
		expect(res.status).toBe(400);
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthed());
		const res = await DELETE(
			new Request("http://localhost/api/projects/myproj/routes?id=1", { method: "DELETE" }),
			ctx(),
		);
		expect(res.status).toBe(401);
	});
});
