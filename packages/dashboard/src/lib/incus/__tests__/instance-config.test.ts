import { describe, it, expect } from "vitest";
import {
	buildScriptArgv,
	validateConfigShape,
	redactConfig,
	type IncusInstanceConfig,
} from "../instance-config";

function baseConfig(over: Partial<IncusInstanceConfig> = {}): IncusInstanceConfig {
	return {
		target: { mode: "existing", repoUrl: "https://github.com/bloodf/demo.git", branch: "main", ghOrg: "bloodf", slug: "demo" },
		image: { alias: "cortexos-base/latest", gastown: false, profiles: [], pool: "cortex-zfs" },
		hermes: { enabled: true, profile: "demo", port: 18700, model: "cx/gpt-5.5", proxies: ["9router", "honcho", "ollama"] },
		network: { bridge: "incusbr0", tailscale: false, webAccess: "direct-tailscale" },
		...over,
	};
}

describe("validateConfigShape", () => {
	it("accepts a well-formed config", () => {
		expect(validateConfigShape(baseConfig()).ok).toBe(true);
	});

	it("rejects bad slug", () => {
		const r = validateConfigShape(baseConfig({ target: { ...baseConfig().target, slug: "1bad" } }));
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/slug/);
	});

	it("requires repoUrl for existing mode", () => {
		const r = validateConfigShape(baseConfig({ target: { ...baseConfig().target, repoUrl: undefined } }));
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/repoUrl/);
	});

	it("does not require repoUrl for new mode", () => {
		const cfg = baseConfig({ target: { mode: "new", branch: "main", ghOrg: "bloodf", slug: "demo" } });
		expect(validateConfigShape(cfg).ok).toBe(true);
	});

	it("validates hermes port range", () => {
		const r = validateConfigShape(baseConfig({ hermes: { ...baseConfig().hermes, port: 100 } }));
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/hermes port/);
	});

	it("requires tailscaleKeyRef when tailscale enabled", () => {
		const r = validateConfigShape(baseConfig({ network: { bridge: "incusbr0", tailscale: true, webAccess: "x" } }));
		expect(r.ok).toBe(false);
		expect(r.errors.join(" ")).toMatch(/tailscaleKeyRef/);
	});
});

describe("buildScriptArgv", () => {
	it("maps all knobs to flags", () => {
		const argv = buildScriptArgv(baseConfig({ image: { alias: "cortexos-gastown-base/latest", gastown: true, profiles: ["extra"], cpu: "4", memory: "4GiB", pool: "cortex-zfs" } }));
		expect(argv).toEqual([
			"--name", "demo", "--slug", "demo", "--branch", "main", "--gh-org", "bloodf",
			"--repo", "https://github.com/bloodf/demo.git",
			"--image", "cortexos-gastown-base/latest", "--profile", "extra",
			"--cpu", "4", "--memory", "4GiB", "--pool", "cortex-zfs",
			"--hermes-profile", "demo", "--hermes-port", "18700", "--hermes-model", "cx/gpt-5.5",
			"--proxies", "9router,honcho,ollama",
			"--bridge", "incusbr0",
			"--web-access", "direct-tailscale",
		]);
	});

	it("emits --skip-hermes when hermes disabled", () => {
		const argv = buildScriptArgv(baseConfig({ hermes: { enabled: false, profile: "", port: 0, model: "", proxies: [] } }));
		expect(argv).toContain("--skip-hermes");
		expect(argv).not.toContain("--hermes-profile");
	});

	it("emits --skip-clone for new-project mode and --tailscale flags", () => {
		const argv = buildScriptArgv(
			baseConfig({
				target: { mode: "new", branch: "main", ghOrg: "bloodf", slug: "demo" },
				network: { bridge: "incusbr0", tailscale: true, tailscaleKeyRef: "ts-demo", webAccess: "x" },
			}),
		);
		expect(argv).toContain("--skip-clone");
		expect(argv).toContain("--tailscale");
		expect(argv).toEqual(expect.arrayContaining(["--tailscale-key-ref", "ts-demo"]));
		expect(argv).not.toContain("--repo");
	});
});

describe("redactConfig", () => {
	it("clamps tailscaleKeyRef length", () => {
		const long = "x".repeat(200);
		const out = redactConfig(baseConfig({ network: { bridge: "incusbr0", tailscale: true, tailscaleKeyRef: long, webAccess: "x" } }));
		expect(out.network.tailscaleKeyRef!.length).toBe(64);
	});
});
