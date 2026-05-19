// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => {
	const fn = vi.fn();
	return { requireAuth: fn, requireAdmin: fn };
});
vi.mock("@/lib/db/agent-factories", () => ({
	listAgentFactories: vi.fn(),
	upsertAgentFactory: vi.fn(),
	deleteAgentFactory: vi.fn(),
}));
vi.mock("@/lib/db/agent-gateway-audit", () => ({
	insertAuditRow: vi.fn().mockResolvedValue({}),
}));

import { GET, POST, PUT, DELETE } from "../route";
import { requireAuth } from "@/lib/auth";
import { listAgentFactories, upsertAgentFactory, deleteAgentFactory } from "@/lib/db/agent-factories";
import { insertAuditRow } from "@/lib/db/agent-gateway-audit";

const mockRequireAuth = vi.mocked(requireAuth);
const mockList = vi.mocked(listAgentFactories);
const mockUpsert = vi.mocked(upsertAgentFactory);
const mockDelete = vi.mocked(deleteAgentFactory);
const mockAudit = vi.mocked(insertAuditRow);

const FAKE_FACTORY = {
	id: 1, slug: "my-factory", name: "My Factory", kind: "role",
	schema_version: 1, definition: {}, created_by: "admin", created_at: new Date(), updated_at: new Date(),
};

function authed() {
	return { error: null, session: { user_id: 1, username: "admin", token: "tok", is_admin: true } };
}
function unauthed() {
	return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }), session: null };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/agent-factory", () => {
	it("lists all factories", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockList.mockResolvedValue([FAKE_FACTORY] as never);

		const res = await GET(new Request("http://localhost/api/agent-factory"));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.factories).toHaveLength(1);
	});

	it("filters by kind", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockList.mockResolvedValue([]);

		await GET(new Request("http://localhost/api/agent-factory?kind=workflow"));
		expect(mockList).toHaveBeenCalledWith({ kind: "workflow" });
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthed());
		const res = await GET(new Request("http://localhost/api/agent-factory"));
		expect(res.status).toBe(401);
	});
});

describe("POST /api/agent-factory", () => {
	it("creates factory and audits", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockUpsert.mockResolvedValue(FAKE_FACTORY as never);

		const res = await POST(new Request("http://localhost/api/agent-factory", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slug: "my-factory", name: "My Factory", kind: "role", definition: {} }),
		}));
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.factory.slug).toBe("my-factory");
		expect(mockAudit).toHaveBeenCalledOnce();
		expect(mockAudit.mock.calls[0][0].tool).toBe("agent_factory.upsert");
	});

	it("returns 400 when required fields missing", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const res = await POST(new Request("http://localhost/api/agent-factory", {
			method: "POST",
			body: JSON.stringify({ slug: "x" }),
		}));
		expect(res.status).toBe(400);
	});

	it("defaults schema_version to 1", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockUpsert.mockResolvedValue(FAKE_FACTORY as never);

		await POST(new Request("http://localhost/api/agent-factory", {
			method: "POST",
			body: JSON.stringify({ slug: "x", name: "X", kind: "role" }),
		}));
		expect(mockUpsert.mock.calls[0][0].schema_version).toBe(1);
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthed());
		const res = await POST(new Request("http://localhost/api/agent-factory", {
			method: "POST",
			body: JSON.stringify({ slug: "x", name: "X", kind: "role" }),
		}));
		expect(res.status).toBe(401);
	});
});

describe("PUT /api/agent-factory", () => {
	it("updates factory by slug", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockUpsert.mockResolvedValue({ ...FAKE_FACTORY, name: "Updated" } as never);

		const res = await PUT(new Request("http://localhost/api/agent-factory?slug=my-factory", {
			method: "PUT",
			body: JSON.stringify({ name: "Updated", kind: "role" }),
		}));
		expect(res.status).toBe(200);
		expect(mockAudit).toHaveBeenCalledOnce();
	});

	it("returns 400 when slug missing", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const res = await PUT(new Request("http://localhost/api/agent-factory", {
			method: "PUT",
			body: JSON.stringify({ name: "x" }),
		}));
		expect(res.status).toBe(400);
	});
});

describe("DELETE /api/agent-factory", () => {
	it("deletes factory and audits", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockDelete.mockResolvedValue(undefined);

		const res = await DELETE(new Request("http://localhost/api/agent-factory?slug=my-factory", { method: "DELETE" }));
		expect(res.status).toBe(200);
		expect(mockAudit.mock.calls[0][0].tool).toBe("agent_factory.delete");
	});

	it("returns 400 when slug missing", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const res = await DELETE(new Request("http://localhost/api/agent-factory", { method: "DELETE" }));
		expect(res.status).toBe(400);
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthed());
		const res = await DELETE(new Request("http://localhost/api/agent-factory?slug=x", { method: "DELETE" }));
		expect(res.status).toBe(401);
	});
});
