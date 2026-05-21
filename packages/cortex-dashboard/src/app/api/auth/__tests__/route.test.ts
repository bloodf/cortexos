// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "../route";

const {
	authenticateUser,
	createUserSession,
	setSessionCookie,
	getCurrentSession,
	logout,
} = vi.hoisted(() => ({
	authenticateUser: vi.fn(),
	createUserSession: vi.fn(),
	setSessionCookie: vi.fn(),
	getCurrentSession: vi.fn(),
	logout: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	authenticateUser,
	createUserSession,
	setSessionCookie,
	getCurrentSession,
	logout,
}));

function jsonReq(body: unknown) {
	return new Request("http://localhost/api/auth", {
		method: "POST",
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
	});
}

describe("auth route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("POST returns success for valid credentials", async () => {
		authenticateUser.mockResolvedValueOnce({ id: 7, username: "admin", is_admin: true });
		const expiresAt = new Date("2030-01-01T00:00:00.000Z");
		createUserSession.mockResolvedValueOnce({ token: "session-token", expiresAt });

		const res = await POST(jsonReq({ username: " admin ", password: "secret" }));

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ success: true, username: "admin" });
		expect(authenticateUser).toHaveBeenCalledWith("admin", "secret");
		expect(createUserSession).toHaveBeenCalledWith(7, true);
		expect(setSessionCookie).toHaveBeenCalledWith("session-token", expiresAt);
	});

	it("POST returns 400 for missing fields", async () => {
		const res = await POST(jsonReq({ username: "", password: "secret" }));

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "Username and password required" });
		expect(authenticateUser).not.toHaveBeenCalled();
	});

	it("POST returns 401 for invalid credentials", async () => {
		authenticateUser.mockResolvedValueOnce(null);

		const res = await POST(jsonReq({ username: "admin", password: "wrong" }));

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "Invalid credentials" });
	});

	it("GET returns authenticated session", async () => {
		getCurrentSession.mockResolvedValueOnce({
			user: { id: 7, username: "admin", is_admin: true },
			token: "session-token",
		});

		const res = await GET();

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ authenticated: true, username: "admin" });
	});

	it("GET returns 401 without session", async () => {
		getCurrentSession.mockResolvedValueOnce(null);

		const res = await GET();

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ authenticated: false });
	});

	it("DELETE logs out", async () => {
		const res = await DELETE();

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ success: true });
		expect(logout).toHaveBeenCalledOnce();
	});
});
