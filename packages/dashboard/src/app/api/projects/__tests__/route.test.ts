// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => {
	const fn = vi.fn();
	return { requireAuth: fn, requireAdmin: fn };
});
vi.mock("@/lib/db/projects", () => ({
	listProjects: vi.fn(),
	createProject: vi.fn(),
	updateProject: vi.fn(),
	deleteProject: vi.fn(),
}));
vi.mock("@/lib/db/dashboard-audit", () => ({
	insertAuditRow: vi.fn().mockResolvedValue({}),
}));

import { GET, POST, PUT, DELETE } from "../route";
import { requireAuth } from "@/lib/auth";
import {
	listProjects,
	createProject,
	updateProject,
	deleteProject,
} from "@/lib/db/projects";
import { insertAuditRow } from "@/lib/db/dashboard-audit";

const mockRequireAuth = vi.mocked(requireAuth);
const mockListProjects = vi.mocked(listProjects);
const mockCreateProject = vi.mocked(createProject);
const mockUpdateProject = vi.mocked(updateProject);
const mockDeleteProject = vi.mocked(deleteProject);
const mockInsertAuditRow = vi.mocked(insertAuditRow);

function authedSession(userId = 1) {
	return { error: null, session: { user_id: userId, username: "admin", token: "tok", is_admin: true } };
}
function unauthSession() {
	return {
		error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
		session: null,
	};
}

function makeRequest(url: string, init?: RequestInit) {
	return new Request(url, init);
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
describe("GET /api/projects", () => {
	it("returns projects list for authed user", async () => {
		mockRequireAuth.mockResolvedValue(authedSession());
		const projects = [{ id: 1, slug: "proj-a", name: "Proj A" }];
		mockListProjects.mockResolvedValue(projects as never);

		const res = await GET(makeRequest("http://localhost/api/projects"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.projects).toEqual(projects);
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthSession());
		const res = await GET(makeRequest("http://localhost/api/projects"));
		expect(res.status).toBe(401);
	});

	it("returns 500 on DB error", async () => {
		mockRequireAuth.mockResolvedValue(authedSession());
		mockListProjects.mockRejectedValue(new Error("DB down"));
		const res = await GET(makeRequest("http://localhost/api/projects"));
		expect(res.status).toBe(500);
	});
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
describe("POST /api/projects", () => {
	it("creates project and writes audit row", async () => {
		mockRequireAuth.mockResolvedValue(authedSession());
		const created = { id: 2, slug: "new-proj", name: "New" };
		mockCreateProject.mockResolvedValue(created as never);

		const res = await POST(
			makeRequest("http://localhost/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slug: "new-proj", name: "New" }),
			}),
		);
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.project).toEqual(created);
		expect(mockInsertAuditRow).toHaveBeenCalledOnce();
		expect(mockInsertAuditRow.mock.calls[0][0].tool).toBe("project.upsert");
	});

	it("returns 400 when slug missing", async () => {
		mockRequireAuth.mockResolvedValue(authedSession());
		const res = await POST(
			makeRequest("http://localhost/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "No slug" }),
			}),
		);
		expect(res.status).toBe(400);
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthSession());
		const res = await POST(
			makeRequest("http://localhost/api/projects", {
				method: "POST",
				body: JSON.stringify({ slug: "x", name: "x" }),
			}),
		);
		expect(res.status).toBe(401);
	});
});

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------
describe("PUT /api/projects", () => {
	it("updates project", async () => {
		mockRequireAuth.mockResolvedValue(authedSession());
		const updated = { id: 1, slug: "proj-a", name: "Updated" };
		mockUpdateProject.mockResolvedValue(updated as never);

		const res = await PUT(
			makeRequest("http://localhost/api/projects?slug=proj-a", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Updated" }),
			}),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.project.name).toBe("Updated");
		expect(mockInsertAuditRow).toHaveBeenCalledOnce();
	});

	it("returns 400 when slug query param missing", async () => {
		mockRequireAuth.mockResolvedValue(authedSession());
		const res = await PUT(
			makeRequest("http://localhost/api/projects", {
				method: "PUT",
				body: JSON.stringify({ name: "x" }),
			}),
		);
		expect(res.status).toBe(400);
	});

	it("returns 404 when project not found", async () => {
		mockRequireAuth.mockResolvedValue(authedSession());
		mockUpdateProject.mockRejectedValue(new Error("Project not found: missing"));
		const res = await PUT(
			makeRequest("http://localhost/api/projects?slug=missing", {
				method: "PUT",
				body: JSON.stringify({ name: "x" }),
			}),
		);
		expect(res.status).toBe(404);
	});
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe("DELETE /api/projects", () => {
	it("deletes project and audits", async () => {
		mockRequireAuth.mockResolvedValue(authedSession());
		mockDeleteProject.mockResolvedValue(undefined);

		const res = await DELETE(
			makeRequest("http://localhost/api/projects?slug=proj-a", { method: "DELETE" }),
		);
		expect(res.status).toBe(200);
		expect(mockInsertAuditRow.mock.calls[0][0].tool).toBe("project.delete");
	});

	it("returns 400 when slug missing", async () => {
		mockRequireAuth.mockResolvedValue(authedSession());
		const res = await DELETE(
			makeRequest("http://localhost/api/projects", { method: "DELETE" }),
		);
		expect(res.status).toBe(400);
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthSession());
		const res = await DELETE(
			makeRequest("http://localhost/api/projects?slug=x", { method: "DELETE" }),
		);
		expect(res.status).toBe(401);
	});
});
