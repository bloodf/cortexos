// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

const { mockExec } = vi.hoisted(() => ({ mockExec: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }) }));

vi.mock("util", async () => {
	const actual = await vi.importActual<typeof import("util")>("util");
	return {
		...actual,
		promisify: vi.fn(() => mockExec),
	};
});

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

describe("docker actions route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 401 without auth", async () => {
		const res = await POST(new Request("http://localhost/api/docker/actions", { method: "POST", body: JSON.stringify({ action: "start", name: "nginx" }) }));
		expect(res.status).toBe(401);
	});

	it("returns 400 for invalid action", async () => {
		const res = await POST(authReq("http://localhost/api/docker/actions", { method: "POST", body: JSON.stringify({ action: "invalid", name: "nginx" }) }));
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error).toBe("Invalid action");
	});

	it("returns 400 for unsafe name", async () => {
		const res = await POST(authReq("http://localhost/api/docker/actions", { method: "POST", body: JSON.stringify({ action: "start", name: "; rm -rf /" }) }));
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error).toBe("Invalid name");
	});

	it("calls docker start and logs success", async () => {
		mockExec.mockResolvedValueOnce({ stdout: "started", stderr: "" });
		const res = await POST(authReq("http://localhost/api/docker/actions", { method: "POST", body: JSON.stringify({ action: "start", name: "nginx" }) }));
		expect(res.status).toBe(200);
		expect(mockExec).toHaveBeenCalledWith("docker", ["start", "nginx"], expect.any(Object));
	});

	it("returns 500 on docker error and logs failure", async () => {
		mockExec.mockRejectedValueOnce(new Error("container not found"));
		const res = await POST(authReq("http://localhost/api/docker/actions", { method: "POST", body: JSON.stringify({ action: "start", name: "nginx" }) }));
		expect(res.status).toBe(500);
		const json = await res.json();
		expect(json.error).toBe("container not found");
	});
});
