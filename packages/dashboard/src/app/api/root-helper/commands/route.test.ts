// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";

const { mockExecuteRootCommand } = vi.hoisted(() => ({
	mockExecuteRootCommand: vi.fn().mockResolvedValue({
		requestId: "00000000-0000-4000-8000-000000000001",
		stdout: "ok",
		stderr: "",
		status: "succeeded",
		exitCode: 0,
		signal: null,
	}),
}));

vi.mock("@/lib/root-helper/executor", () => ({
	executeRootCommand: mockExecuteRootCommand,
}));

vi.mock("@/lib/auth", () => ({
	requireAdmin: vi.fn().mockImplementation(async (req: Request) => {
		const token = req.headers.get("authorization")?.replace("Bearer ", "");
		if (!token) {
			return {
				error: new Response(JSON.stringify({ error: "Unauthorized" }), {
					status: 401,
				}),
				session: null,
			};
		}
		return {
			error: null,
			session: { user_id: 1, username: "admin", token, is_admin: true },
		};
	}),
}));

function authReq(body: unknown) {
	return new Request("http://localhost/api/root-helper/commands", {
		method: "POST",
		headers: {
			authorization: "Bearer test-token",
			"content-type": "application/json",
			"x-forwarded-for": "100.64.0.10",
		},
		body: JSON.stringify(body),
	});
}

describe("root helper command route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("requires auth", async () => {
		const res = await POST(
			new Request("http://localhost/api/root-helper/commands", {
				method: "POST",
				body: JSON.stringify({ command: "/bin/true" }),
			}),
		);
		expect(res.status).toBe(401);
	});

	it("rejects missing command", async () => {
		const res = await POST(authReq({ argv: [] }));
		expect(res.status).toBe(400);
	});

	it("executes through audited helper", async () => {
		const res = await POST(
			authReq({
				command: "/bin/echo",
				argv: ["ok"],
				env: { SAFE_ENV: "1" },
				mutationClass: "manual-command",
			}),
		);
		expect(res.status).toBe(200);
		expect(mockExecuteRootCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				command: "/bin/echo",
				argv: ["ok"],
				env: { SAFE_ENV: "1" },
				sourceIp: "100.64.0.10",
				dashboardSessionId: "user-1",
			}),
		);
	});
});
