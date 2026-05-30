// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, PUT, DELETE } from "./route";

vi.mock("@/lib/auth", () => ({
	requireAuth: vi.fn().mockImplementation(async (req: Request) => {
		const token = req.headers.get("authorization")?.replace("Bearer ", "");
		if (!token) {
			return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }), session: null };
		}
		return { error: null, session: { user_id: 1, username: "admin", token } };
	}),
}));

vi.mock("@/lib/db/badges", () => ({
	listBadges: vi.fn(),
	getBadgeBySlug: vi.fn(),
	createBadge: vi.fn(),
	updateBadge: vi.fn(),
	deleteBadge: vi.fn(),
}));

import { listBadges, getBadgeBySlug, createBadge, updateBadge, deleteBadge } from "@/lib/db/badges";

function authReq(url: string, init?: RequestInit) {
	return new Request(url, {
		...init,
		headers: {
			...((init?.headers as Record<string, string>) || {}),
			authorization: "Bearer test-token",
		},
	});
}

describe("badges route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("GET lists all badges", async () => {
		const rows = [{ id: 1, slug: "ai", label: "AI", color: "#6366f1", text_color: "#ffffff" }];
		(listBadges as any).mockResolvedValue(rows);

		const res = await GET(new Request("http://localhost/api/badges"));
		const json = await res.json();
		expect(json.badges).toEqual(rows);
	});

	it("GET returns badge by slug", async () => {
		const row = { id: 1, slug: "ai", label: "AI", color: "#6366f1", text_color: "#ffffff" };
		(getBadgeBySlug as any).mockResolvedValue(row);

		const res = await GET(new Request("http://localhost/api/badges?slug=ai"));
		const json = await res.json();
		expect(json.badge).toEqual(row);
	});

	it("GET returns 404 when badge slug not found", async () => {
		(getBadgeBySlug as any).mockResolvedValue(null);

		const res = await GET(new Request("http://localhost/api/badges?slug=missing"));
		expect(res.status).toBe(404);
	});

	it("POST creates badge", async () => {
		const row = { id: 2, slug: "db", label: "DB", color: "#10b981", text_color: "#ffffff" };
		(createBadge as any).mockResolvedValue(row);

		const res = await POST(
			authReq("http://localhost/api/badges", {
				method: "POST",
				body: JSON.stringify({ slug: "db", label: "DB", color: "#10b981", text_color: "#ffffff" }),
			}),
		);
		const json = await res.json();
		expect(res.status).toBe(201);
		expect(json.badge).toEqual(row);
	});

	it("POST returns 400 without slug", async () => {
		const res = await POST(
			authReq("http://localhost/api/badges", {
				method: "POST",
				body: JSON.stringify({ label: "DB" }),
			}),
		);
		expect(res.status).toBe(400);
	});

	it("PUT updates badge by slug", async () => {
		const row = { id: 1, slug: "ai", label: "AI Updated", color: "#6366f1", text_color: "#ffffff" };
		(updateBadge as any).mockResolvedValue(row);

		const res = await PUT(
			authReq("http://localhost/api/badges?slug=ai", {
				method: "PUT",
				body: JSON.stringify({ label: "AI Updated" }),
			}),
		);
		const json = await res.json();
		expect(json.badge).toEqual(row);
	});

	it("PUT returns 400 with no fields", async () => {
		const res = await PUT(
			authReq("http://localhost/api/badges?slug=ai", {
				method: "PUT",
				body: JSON.stringify({}),
			}),
		);
		expect(res.status).toBe(400);
	});

	it("PUT returns 400 without slug param", async () => {
		const res = await PUT(
			authReq("http://localhost/api/badges", {
				method: "PUT",
				body: JSON.stringify({ label: "X" }),
			}),
		);
		expect(res.status).toBe(400);
	});

	it("DELETE removes badge by slug", async () => {
		(deleteBadge as any).mockResolvedValue(undefined);

		const res = await DELETE(authReq("http://localhost/api/badges?slug=ai"));
		const json = await res.json();
		expect(json.success).toBe(true);
	});

	it("DELETE returns 400 without slug param", async () => {
		const res = await DELETE(authReq("http://localhost/api/badges"));
		expect(res.status).toBe(400);
	});

	it("mutations return 401 without auth", async () => {
		const req = new Request("http://localhost/api/badges", {
			method: "POST",
			body: JSON.stringify({ slug: "ai", label: "AI" }),
		});
		const res = await POST(req);
		expect(res.status).toBe(401);
	});
});
