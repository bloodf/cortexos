// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => {
	const fn = vi.fn();
	return { requireAuth: fn, requireAdmin: fn };
});
vi.mock("@/lib/secrets/vps-reader", () => ({
	readEnvFile: vi.fn(),
	readEnvFileRaw: vi.fn(),
}));
vi.mock("@/lib/secrets/vps-writer", () => ({
	writeEnvFile: vi.fn(),
}));
vi.mock("@/lib/db/tool-audit", () => ({
	insertAuditRow: vi.fn().mockResolvedValue({}),
}));

import { GET, POST } from "../route";
import { requireAuth } from "@/lib/auth";
import { readEnvFile, readEnvFileRaw } from "@/lib/secrets/vps-reader";
import { writeEnvFile } from "@/lib/secrets/vps-writer";
import { insertAuditRow } from "@/lib/db/tool-audit";

const mockRequireAuth = vi.mocked(requireAuth);
const mockReadEnvFile = vi.mocked(readEnvFile);
const mockReadEnvFileRaw = vi.mocked(readEnvFileRaw);
const mockWriteEnvFile = vi.mocked(writeEnvFile);
const mockInsertAuditRow = vi.mocked(insertAuditRow);

const ALLOWED_PATH = "/opt/cortexos/.secrets/test.env";

function authed(userId = 1) {
	return { error: null, session: { user_id: userId, username: "admin", token: "sess-tok", is_admin: true } };
}
function unauthed() {
	return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }), session: null };
}

function makeDenied(): Error & { code: string } {
	const e = new Error("Path denied") as Error & { code: string };
	e.code = "EPATHDENIED";
	return e;
}
function makeNotFound(): Error & { code: string } {
	const e = new Error("not found") as Error & { code: string };
	e.code = "ENOENT";
	return e;
}

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// GET — masked read
// ---------------------------------------------------------------------------
describe("GET /api/env-browser (masked)", () => {
	it("returns masked lines and writes audit row", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const lines = [{ line: 1, raw: "FOO=bar", type: "kv", key: "FOO", value: "bar" }];
		mockReadEnvFile.mockResolvedValue(lines as never);

		const res = await GET(new Request(`http://localhost/api/env-browser?path=${encodeURIComponent(ALLOWED_PATH)}`));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.lines).toHaveLength(1);
		expect(mockInsertAuditRow).toHaveBeenCalledOnce();
		expect(mockInsertAuditRow.mock.calls[0][0].tool).toBe("env.read");
		expect(mockInsertAuditRow.mock.calls[0][0].tool_class).toBe("privileged");
	});

	it("returns 403 for denied path", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockReadEnvFile.mockRejectedValue(makeDenied());
		const res = await GET(new Request(`http://localhost/api/env-browser?path=/etc/shadow`));
		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.code).toBe("EPATHDENIED");
	});

	it("returns 404 for missing file", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockReadEnvFile.mockRejectedValue(makeNotFound());
		const res = await GET(new Request(`http://localhost/api/env-browser?path=${encodeURIComponent(ALLOWED_PATH)}`));
		expect(res.status).toBe(404);
	});

	it("returns 400 when path missing", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const res = await GET(new Request("http://localhost/api/env-browser"));
		expect(res.status).toBe(400);
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthed());
		const res = await GET(new Request(`http://localhost/api/env-browser?path=${encodeURIComponent(ALLOWED_PATH)}`));
		expect(res.status).toBe(401);
	});
});

// ---------------------------------------------------------------------------
// GET — reveal mode
// ---------------------------------------------------------------------------
describe("GET /api/env-browser (reveal)", () => {
	it("returns requested keys cleartext and audits for admin sessions", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const raw = [{ line: 1, raw: "SECRET_KEY=abc123", type: "kv", key: "SECRET_KEY", value: "abc123" }];
		mockReadEnvFileRaw.mockResolvedValue(raw as never);

		const url = `http://localhost/api/env-browser?path=${encodeURIComponent(ALLOWED_PATH)}&reveal=true&keys=SECRET_KEY`;
		const res = await GET(new Request(url));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.keys.SECRET_KEY).toBe("abc123");
		expect(mockInsertAuditRow).toHaveBeenCalledOnce();
		expect(mockInsertAuditRow.mock.calls[0][0].tool).toBe("env_reveal");
	});

	it("returns 400 when keys param missing with reveal=true", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const res = await GET(
			new Request(`http://localhost/api/env-browser?path=${encodeURIComponent(ALLOWED_PATH)}&reveal=true`),
		);
		expect(res.status).toBe(400);
	});

	it("returns 403 for denied path in reveal mode", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockReadEnvFileRaw.mockRejectedValue(makeDenied());
		const res = await GET(
			new Request(`http://localhost/api/env-browser?path=/etc/shadow&reveal=true&keys=FOO`),
		);
		expect(res.status).toBe(403);
	});
});

// ---------------------------------------------------------------------------
// POST — write
// ---------------------------------------------------------------------------
describe("POST /api/env-browser", () => {
	it("writes env updates and audits for admin sessions", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockWriteEnvFile.mockResolvedValue({ beforeSha256: "aaa", afterSha256: "bbb" });

		const res = await POST(
			new Request("http://localhost/api/env-browser", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					path: ALLOWED_PATH,
					updates: [{ key: "FOO", value: "bar" }],
				}),
			}),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.beforeSha256).toBe("aaa");
		expect(body.afterSha256).toBe("bbb");
		expect(mockInsertAuditRow).toHaveBeenCalledOnce();
		expect(mockInsertAuditRow.mock.calls[0][0].before_state_hash).toBe("aaa");
		expect(mockInsertAuditRow.mock.calls[0][0].after_state_hash).toBe("bbb");
		expect(mockInsertAuditRow.mock.calls[0][0].tool).toBe("env.write");
	});

	it("returns 403 when path denied", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		mockWriteEnvFile.mockRejectedValue(makeDenied());

		const res = await POST(
			new Request("http://localhost/api/env-browser", {
				method: "POST",
				body: JSON.stringify({ path: "/etc/shadow", updates: [{ key: "X", value: "1" }] }),
			}),
		);
		expect(res.status).toBe(403);
	});

	it("returns 401 for unauthenticated", async () => {
		mockRequireAuth.mockResolvedValue(unauthed());
		const res = await POST(
			new Request("http://localhost/api/env-browser", {
				method: "POST",
				body: JSON.stringify({ path: ALLOWED_PATH, updates: [{ key: "X", value: "1" }] }),
			}),
		);
		expect(res.status).toBe(401);
	});

	it("never returns cleartext in error message", async () => {
		mockRequireAuth.mockResolvedValue(authed());
		const keyErr = new Error("Invalid key=SECRET_VALUE_123") as Error & { code: string };
		keyErr.code = "EENVKEY";
		mockWriteEnvFile.mockRejectedValue(keyErr);

		const res = await POST(
			new Request("http://localhost/api/env-browser", {
				method: "POST",
				body: JSON.stringify({ path: ALLOWED_PATH, updates: [{ key: "BAD KEY!", value: "secret" }] }),
			}),
		);
		expect(res.status).toBe(400);
		const body = await res.json();
		// Must not contain the cleartext value
		expect(JSON.stringify(body)).not.toContain("SECRET_VALUE_123");
	});
});
