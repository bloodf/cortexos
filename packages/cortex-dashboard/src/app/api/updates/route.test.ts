// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { hostExecFile } from "@/lib/host-exec";

vi.mock("@/lib/auth", () => ({
	requireAdmin: vi.fn().mockResolvedValue({
		error: null,
		session: { user_id: 1, username: "admin", token: "session", is_admin: true },
	}),
}));

vi.mock("@/lib/db/action-log", () => ({
	createActionLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/host-exec", () => ({
	hostExecFile: vi.fn(),
}));

function mockHostExec() {
	(hostExecFile as any).mockImplementation(async (bin: string, args: string[]) => {
		if (bin === "apt") return { stdout: "Listing...\n", stderr: "" };
		if (bin === "bash") return { stdout: "/usr/bin/npm\n", stderr: "" };
		if (bin === "/usr/bin/npm" && args[0] === "outdated") {
			const error = new Error("Command failed: npm outdated -g --json") as Error & { stdout: string; stderr: string };
			error.stdout = JSON.stringify({
				"9router": { current: "0.4.59", wanted: "0.4.63", latest: "0.4.63" },
			});
			error.stderr = "";
			throw error;
		}
		if (bin === "sudo" && args[1] === "/usr/bin/npm") {
			return { stdout: "updated 1 package\n", stderr: "" };
		}
		if (bin === "sudo" && args[1] === "systemctl") {
			return { stdout: `restarted ${args[3]}\n`, stderr: "" };
		}
		throw new Error(`Unexpected command: ${bin} ${args.join(" ")}`);
	});
}

describe("/api/updates", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockHostExec();
	});

	it("lists npm updates when npm outdated exits non-zero with JSON stdout", async () => {
		const res = await GET(new Request("http://localhost/api/updates"));
		const json = await res.json();

		expect(res.status).toBe(200);
		expect(json.updates).toEqual([
			expect.objectContaining({
				id: "npm:9router",
				manager: "npm",
				name: "9router",
				currentVersion: "0.4.59",
				latestVersion: "0.4.63",
				restartServices: ["9router.service", "9router-docker-proxy.service"],
			}),
		]);
	});

	it("applies npm global updates through passwordless sudo and restarts mapped services", async () => {
		const res = await POST(
			new Request("http://localhost/api/updates", {
				method: "POST",
				body: JSON.stringify({ manager: "npm", name: "9router" }),
			}),
		);
		const json = await res.json();

		expect(res.status).toBe(200);
		expect(json.success).toBe(true);
		expect(hostExecFile).toHaveBeenCalledWith(
			"sudo",
			["-n", "/usr/bin/npm", "i", "-g", "9router@latest", "--prefer-online"],
			expect.objectContaining({ timeout: 10 * 60_000 }),
		);
		expect(hostExecFile).toHaveBeenCalledWith(
			"sudo",
			["-n", "systemctl", "restart", "9router.service"],
			expect.objectContaining({ timeout: 60_000 }),
		);
		expect(hostExecFile).toHaveBeenCalledWith(
			"sudo",
			["-n", "systemctl", "restart", "9router-docker-proxy.service"],
			expect.objectContaining({ timeout: 60_000 }),
		);
		expect(json.restarts).toEqual([
			expect.objectContaining({ service: "9router.service" }),
			expect.objectContaining({ service: "9router-docker-proxy.service" }),
		]);
	});
});
