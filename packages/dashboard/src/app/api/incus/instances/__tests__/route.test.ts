import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/db/incus-instances", () => ({
	listIncusInstances: vi.fn(),
	createIncusInstance: vi.fn(),
	getIncusInstance: vi.fn(),
}));

import { GET, POST } from "../route";
import { requireAdmin } from "@/lib/auth";
import {
	listIncusInstances,
	createIncusInstance,
	getIncusInstance,
} from "@/lib/db/incus-instances";

const mockAuth = { error: null, session: { user_id: 1, username: "admin" } };

function validConfig() {
	return {
		target: { mode: "existing", repoUrl: "https://github.com/bloodf/demo.git", branch: "main", ghOrg: "bloodf", slug: "demo" },
		image: { alias: "cortexos-base/latest", gastown: false, profiles: [], pool: "cortex-zfs" },
		hermes: { enabled: true, profile: "demo", port: 18700, model: "m", proxies: ["9router"] },
		network: { bridge: "incusbr0", tailscale: false, webAccess: "direct-tailscale" },
	};
}

function req(body: unknown): Request {
	return new Request("http://localhost/api/incus/instances", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("/api/incus/instances", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(requireAdmin as any).mockResolvedValue(mockAuth);
		(getIncusInstance as any).mockResolvedValue(null);
		(createIncusInstance as any).mockResolvedValue({ id: 1, name: "demo", status: "draft" });
		(listIncusInstances as any).mockResolvedValue([]);
	});

	it("GET lists configs (admin)", async () => {
		const res = await GET(new Request("http://localhost/api/incus/instances"));
		expect(res.status).toBe(200);
		expect(listIncusInstances).toHaveBeenCalled();
	});

	it("GET denies non-admin", async () => {
		(requireAdmin as any).mockResolvedValue({ error: new Response("no", { status: 403 }) });
		const res = await GET(new Request("http://localhost/api/incus/instances"));
		expect(res.status).toBe(403);
	});

	it("POST creates a draft from valid config", async () => {
		const res = await POST(req({ config: validConfig() }));
		expect(res.status).toBe(201);
		expect(createIncusInstance).toHaveBeenCalledWith(
			expect.objectContaining({ name: "demo", status: "draft", created_by: "admin" }),
		);
	});

	it("POST rejects invalid config shape", async () => {
		const bad = validConfig();
		bad.target.slug = "1bad";
		const res = await POST(req({ config: bad }));
		expect(res.status).toBe(400);
	});

	it("POST 409 when config already exists", async () => {
		(getIncusInstance as any).mockResolvedValue({ id: 1, name: "demo" });
		const res = await POST(req({ config: validConfig() }));
		expect(res.status).toBe(409);
	});
});
