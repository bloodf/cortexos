// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

const { mockExecuteRootCommand } = vi.hoisted(() => ({
	mockExecuteRootCommand: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }),
}));

vi.mock("@/lib/root-helper/executor", () => ({
	executeRootCommand: mockExecuteRootCommand,
}));

vi.mock("@/lib/auth", () => {
	const handler = vi.fn().mockImplementation(async (req: Request) => {
		const token = req.headers.get("authorization")?.replace("Bearer ", "");
		if (!token) {
			return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }), session: null };
		}
		return { error: null, session: { user_id: 1, username: "admin", token, is_admin: true } };
	});
	return { requireAuth: handler, requireAdmin: handler };
});

vi.mock("@/lib/db/action-log", () => ({
	createActionLog: vi.fn().mockResolvedValue({ id: 1 }),
}));

function authReq(url: string, init?: RequestInit) {
	return new Request(url, {
		...init,
		headers: {
			...((init?.headers as Record<string, string>) || {}),
			authorization: "Bearer test-token",
		},
	});
}

describe("incus actions route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 401 without auth", async () => {
		const res = await POST(new Request("http://localhost/api/incus/actions", { method: "POST", body: JSON.stringify({ action: "start", name: "test" }) }));
		expect(res.status).toBe(401);
	});

	it("returns 400 for invalid action", async () => {
		const res = await POST(authReq("http://localhost/api/incus/actions", { method: "POST", body: JSON.stringify({ action: "invalid", name: "test" }) }));
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error).toBe("Invalid action");
	});

	it("returns 400 for unsafe name", async () => {
		const res = await POST(authReq("http://localhost/api/incus/actions", { method: "POST", body: JSON.stringify({ action: "start", name: "; rm -rf /" }) }));
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error).toBe("Invalid name");
	});

	it("requires confirm header for delete", async () => {
		const res = await POST(authReq("http://localhost/api/incus/actions", { method: "POST", body: JSON.stringify({ action: "delete", name: "test" }) }));
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error).toContain("x-incus-delete-confirm");
	});

	it("calls incus start and logs success", async () => {
		mockExecuteRootCommand.mockResolvedValueOnce({ stdout: "started", stderr: "" });
		const res = await POST(authReq("http://localhost/api/incus/actions", { method: "POST", body: JSON.stringify({ action: "start", name: "test" }) }));
		expect(res.status).toBe(200);
		expect(mockExecuteRootCommand).toHaveBeenCalledWith(expect.objectContaining({
			command: "incus",
			argv: ["start", "test"],
			mutationClass: "incus-control",
		}));
	});

	it("returns 500 on incus error and logs failure", async () => {
		mockExecuteRootCommand.mockRejectedValueOnce(new Error("instance not found"));
		const res = await POST(authReq("http://localhost/api/incus/actions", { method: "POST", body: JSON.stringify({ action: "start", name: "test" }) }));
		expect(res.status).toBe(500);
		const json = await res.json();
		expect(json.error).toBe("instance not found");
	});
});
