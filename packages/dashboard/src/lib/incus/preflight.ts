/**
 * Deterministic, read-only pre-flight checks for an Incus instance config.
 *
 * These are authoritative: the provision gate uses this result (AI advice is
 * additive/advisory only). All host reads go through the existing read-only
 * `hostExecFile` helper — no mutations, no secrets printed.
 */
import { hostExecFile } from "@/lib/host-exec";
import type { IncusInstanceConfig } from "./instance-config";

export interface PreflightCheck {
	id: string;
	label: string;
	pass: boolean;
	detail?: string;
}

export interface PreflightReport {
	ok: boolean;
	checks: PreflightCheck[];
}

async function incusJson<T>(args: string[]): Promise<T | null> {
	try {
		const { stdout } = await hostExecFile("incus", args, {
			timeout: 15000,
			maxBuffer: 5 * 1024 * 1024,
		});
		return JSON.parse(stdout) as T;
	} catch {
		return null;
	}
}

async function nameIsFree(name: string): Promise<PreflightCheck> {
	const list = await incusJson<Array<{ name: string }>>(["list", "--format", "json"]);
	if (list === null) {
		return { id: "name", label: "Instance name available", pass: false, detail: "could not query incus" };
	}
	const taken = list.some((i) => i.name === name);
	return {
		id: "name",
		label: "Instance name available",
		pass: !taken,
		detail: taken ? `instance "${name}" already exists` : undefined,
	};
}

async function imageExists(alias: string): Promise<PreflightCheck> {
	const images = await incusJson<Array<{ aliases?: Array<{ name: string }> }>>([
		"image",
		"list",
		"--format",
		"json",
	]);
	if (images === null) {
		return { id: "image", label: "Base image present", pass: false, detail: "could not query incus images" };
	}
	const found = images.some((img) => (img.aliases ?? []).some((a) => a.name === alias));
	return {
		id: "image",
		label: "Base image present",
		pass: found,
		detail: found ? undefined : `no local image alias "${alias}"`,
	};
}

async function resourceExists(
	id: string,
	label: string,
	kind: "storage" | "network",
	name: string,
): Promise<PreflightCheck> {
	try {
		await hostExecFile("incus", [kind, "show", name], { timeout: 10000 });
		return { id, label, pass: true };
	} catch {
		return { id, label, pass: false, detail: `${kind} "${name}" not found` };
	}
}

async function hermesSecretPresent(profile: string): Promise<PreflightCheck> {
	const path = `/opt/cortexos/.secrets/hermes/${profile}.env`;
	try {
		await hostExecFile("test", ["-f", path], { timeout: 5000 });
		return { id: "hermes-secret", label: "Hermes secret file present", pass: true };
	} catch {
		return {
			id: "hermes-secret",
			label: "Hermes secret file present",
			pass: false,
			detail: `missing ${path}`,
		};
	}
}

export async function runPreflight(cfg: IncusInstanceConfig): Promise<PreflightReport> {
	const checks: PreflightCheck[] = [];
	checks.push(await nameIsFree(cfg.target.slug));
	checks.push(await imageExists(cfg.image.alias));
	checks.push(await resourceExists("pool", "Storage pool present", "storage", cfg.image.pool));
	checks.push(await resourceExists("bridge", "Network bridge present", "network", cfg.network.bridge));
	if (cfg.hermes.enabled) {
		checks.push(await hermesSecretPresent(cfg.hermes.profile));
	}
	return { ok: checks.every((c) => c.pass), checks };
}
