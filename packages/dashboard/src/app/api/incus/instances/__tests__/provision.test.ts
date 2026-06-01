import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/root-helper/executor", () => ({ executeRootCommand: vi.fn() }));
vi.mock("@/lib/db/action-log", () => ({ createActionLog: vi.fn() }));
vi.mock("@/lib/db/incus-instances", () => ({
	getIncusInstance: vi.fn(),
	updateIncusInstanceStatus: vi.fn(),
	SAFE_NAME_RE: /^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/,
}));

import { POST } from "../[name]/provision/route";
import { requireAdmin } from "@/lib/auth";
import { executeRootCommand } from "@/lib/root-helper/executor";
import { createActionLog } from "@/lib/db/action-log";
import { getIncusInstance, updateIncusInstanceStatus } from "@/lib/db/incus-instances";

const mockAuth = { error: null, session: { user_id: 1, username: "admin" } };

function cfg() {
	return {
		target: { mode: "existing", repoUrl: "https://github.com/bloodf/demo.git", branch: "main", ghOrg: "bloodf", slug: "demo" },
		image: { alias: "cortexos-base/latest", gastown: false, profiles: [], pool: "cortex-zfs" },
		hermes: { enabled: true, profile: "demo", port: 18700, model: "m", proxies: ["9router"] },
		network: { bridge: "incusbr0", tailscale: false, webAccess: "direct-tailscale" },
	};
}

function ctx(name: string) {
	return { params: Promise.resolve({ name }) };
}
function req(body: unknown = {}): Request {
	return new Request("http://localhost/api/incus/instances/demo/provision", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST provision", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireAdmin as any).mockResolvedValue(mockAuth);
		(updateIncusInstanceStatus as any).mockResolvedValue({});
		(createActionLog as any).mockResolvedValue({});
		(executeRootCommand as any).mockResolvedValue({ stdout: "done", stderr: "" });
		(getIncusInstance as any).mockResolvedValue({ name: "demo", status: "validated", config: cfg() });
	});

	it("provisions a validated config via bash + script", async () => {
		const res = await POST(req(), ctx("demo"));
		expect(res.status).toBe(200);
		const call = (executeRootCommand as any).mock.calls[0][0];
		expect(call.command).toBe("bash");
		expect(call.argv[0]).toMatch(/cortex-incus-instance-create\.sh$/);
		expect(call.argv).toContain("--json-progress");
		expect(call.mutationClass).toBe("incus-provision");
		// status transitions: provisioning then active
		expect(updateIncusInstanceStatus).toHaveBeenCalledWith("demo", "provisioning", expect.any(Object));
		expect(updateIncusInstanceStatus).toHaveBeenCalledWith("demo", "active");
	});

	it("409 when not validated and no force", async () => {
		(getIncusInstance as any).mockResolvedValue({ name: "demo", status: "draft", config: cfg() });
		const res = await POST(req(), ctx("demo"));
		expect(res.status).toBe(409);
	});

	it("allows force when not validated", async () => {
		(getIncusInstance as any).mockResolvedValue({ name: "demo", status: "draft", config: cfg() });
		const res = await POST(req({ force: true }), ctx("demo"));
		expect(res.status).toBe(200);
	});

	it("marks failed + logs failure on script error", async () => {
		(executeRootCommand as any).mockRejectedValue(new Error("boom"));
		const res = await POST(req(), ctx("demo"));
		expect(res.status).toBe(500);
		expect(updateIncusInstanceStatus).toHaveBeenCalledWith("demo", "failed");
		expect(createActionLog).toHaveBeenCalledWith(
			expect.objectContaining({ action: "provision", status: "failure" }),
		);
	});

	it("denies non-admin", async () => {
		(requireAdmin as any).mockResolvedValue({ error: new Response("no", { status: 403 }) });
		const res = await POST(req(), ctx("demo"));
		expect(res.status).toBe(403);
	});
});
