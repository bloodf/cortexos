import { describe, it, expect, vi, beforeEach } from "vitest";
import { hostExecFile } from "@/lib/host-exec";
import { runPreflight } from "../preflight";
import type { IncusInstanceConfig } from "../instance-config";

vi.mock("@/lib/host-exec", () => ({ hostExecFile: vi.fn() }));

const cfg: IncusInstanceConfig = {
	target: { mode: "existing", repoUrl: "https://github.com/bloodf/demo.git", branch: "main", ghOrg: "bloodf", slug: "demo" },
	image: { alias: "cortexos-base/latest", gastown: false, profiles: [], pool: "cortex-zfs" },
	hermes: { enabled: true, profile: "demo", port: 18700, model: "m", proxies: ["9router"] },
	network: { bridge: "incusbr0", tailscale: false, webAccess: "x" },
};

function mockHost(impl: (bin: string, args: string[]) => { stdout: string } | never) {
	(hostExecFile as any).mockImplementation(async (bin: string, args: string[]) => impl(bin, args));
}

describe("runPreflight", () => {
	beforeEach(() => vi.clearAllMocks());

	it("passes when name free, image present, pool/bridge/secret ok", async () => {
		mockHost((bin, args) => {
			if (args[0] === "list") return { stdout: JSON.stringify([{ name: "other" }]) };
			if (args[0] === "image") return { stdout: JSON.stringify([{ aliases: [{ name: "cortexos-base/latest" }] }]) };
			if (bin === "incus" && (args[0] === "storage" || args[0] === "network")) return { stdout: "" };
			if (bin === "test") return { stdout: "" };
			return { stdout: "" };
		});
		const r = await runPreflight(cfg);
		expect(r.ok).toBe(true);
		expect(r.checks.find((c) => c.id === "name")!.pass).toBe(true);
		expect(r.checks.find((c) => c.id === "hermes-secret")!.pass).toBe(true);
	});

	it("fails when instance name is taken", async () => {
		mockHost((bin, args) => {
			if (args[0] === "list") return { stdout: JSON.stringify([{ name: "demo" }]) };
			if (args[0] === "image") return { stdout: JSON.stringify([{ aliases: [{ name: "cortexos-base/latest" }] }]) };
			return { stdout: "" };
		});
		const r = await runPreflight(cfg);
		expect(r.ok).toBe(false);
		expect(r.checks.find((c) => c.id === "name")!.pass).toBe(false);
	});

	it("fails when image alias missing", async () => {
		mockHost((bin, args) => {
			if (args[0] === "list") return { stdout: JSON.stringify([]) };
			if (args[0] === "image") return { stdout: JSON.stringify([{ aliases: [{ name: "other/latest" }] }]) };
			return { stdout: "" };
		});
		const r = await runPreflight(cfg);
		expect(r.ok).toBe(false);
		expect(r.checks.find((c) => c.id === "image")!.pass).toBe(false);
	});

	it("fails when hermes secret missing", async () => {
		mockHost((bin, args) => {
			if (args[0] === "list") return { stdout: JSON.stringify([]) };
			if (args[0] === "image") return { stdout: JSON.stringify([{ aliases: [{ name: "cortexos-base/latest" }] }]) };
			if (bin === "test") throw new Error("missing");
			return { stdout: "" };
		});
		const r = await runPreflight(cfg);
		expect(r.ok).toBe(false);
		expect(r.checks.find((c) => c.id === "hermes-secret")!.pass).toBe(false);
	});

	it("skips hermes-secret check when hermes disabled", async () => {
		mockHost((bin, args) => {
			if (args[0] === "list") return { stdout: JSON.stringify([]) };
			if (args[0] === "image") return { stdout: JSON.stringify([{ aliases: [{ name: "cortexos-base/latest" }] }]) };
			return { stdout: "" };
		});
		const r = await runPreflight({ ...cfg, hermes: { ...cfg.hermes, enabled: false } });
		expect(r.checks.find((c) => c.id === "hermes-secret")).toBeUndefined();
	});
});
