// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../route";

const { getCurrentSession } = vi.hoisted(() => ({
	getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	getCurrentSession,
}));

const PAM_MESSAGE = "Dashboard passwords are managed by Linux PAM. Change the system account password on the host with passwd, Cockpit, Webmin, or SSH.";

describe("auth password route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("GET returns PAM password management message", async () => {
		const res = await GET();

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ message: PAM_MESSAGE });
	});

	it("POST returns 401 without session", async () => {
		getCurrentSession.mockResolvedValueOnce(null);

		const res = await POST();

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: "Unauthorized" });
	});

	it("POST returns 409 with PAM message for authenticated users", async () => {
		getCurrentSession.mockResolvedValueOnce({
			user: { id: 7, username: "admin", is_admin: true },
			token: "session-token",
		});

		const res = await POST();

		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({ error: PAM_MESSAGE });
	});
});
