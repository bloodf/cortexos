import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createActionLog } from "@/lib/db/action-log";
import { hostExecFile } from "@/lib/host-exec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_PACKAGE_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.+@:/-]{0,255}$/;
const SAFE_SERVICE_RE = /^[a-zA-Z0-9_.@:-]{1,255}$/;

interface UpdateItem {
	id: string;
	name: string;
	manager: "apt" | "npm";
	currentVersion?: string;
	latestVersion?: string;
	description?: string;
	restartServices?: string[];
}

interface ExecErrorWithOutput extends Error {
	stdout?: string | Buffer;
	stderr?: string | Buffer;
}

function validPackageName(name: string) {
	return SAFE_PACKAGE_RE.test(name);
}

function validServiceName(name: string) {
	return SAFE_SERVICE_RE.test(name);
}

function restartServicesForPackage(manager: UpdateItem["manager"], name: string): string[] {
	if (manager === "npm" && name.toLowerCase() === "9router") {
		return ["9router.service", "9router-docker-proxy.service"];
	}
	return [];
}

async function findHostBin(name: string, fallbacks: string[]): Promise<string | null> {
	try {
		const { stdout } = await hostExecFile("bash", [
			"-lc",
			"command -v \"$1\" || for candidate in \"${@:2}\"; do [ -x \"$candidate\" ] && printf '%s\\n' \"$candidate\" && exit 0; done",
			"find-host-bin",
			name,
			...fallbacks,
		], { timeout: 10_000, maxBuffer: 1024 * 1024 });
		return stdout.trim().split("\n")[0] || null;
	} catch {
		return null;
	}
}

async function findNpmBin(): Promise<string | null> {
	return findHostBin("npm", [
		"/home/linuxbrew/.linuxbrew/bin/npm",
		"/home/linuxbrew/.linuxbrew/opt/node@24/bin/npm",
		"/usr/local/bin/npm",
		"/usr/bin/npm",
	]);
}

function outputFromExecError(error: unknown): string {
	if (!error || typeof error !== "object") return "";
	const err = error as ExecErrorWithOutput;
	if (typeof err.stdout === "string") return err.stdout;
	if (Buffer.isBuffer(err.stdout)) return err.stdout.toString("utf-8");
	return "";
}

function parseNpmOutdated(stdout: string): UpdateItem[] {
	if (!stdout.trim()) return [];
	const parsed = JSON.parse(stdout) as Record<string, { current?: string; wanted?: string; latest?: string }>;
	return Object.entries(parsed).map(([name, info]) => ({
		id: `npm:${name}`,
		manager: "npm",
		name,
		currentVersion: info.current,
		latestVersion: info.latest ?? info.wanted,
		description: "Global npm package",
		restartServices: restartServicesForPackage("npm", name),
	}));
}

async function sudoHostExecFile(bin: string, args: string[], opts: { timeout?: number; maxBuffer?: number } = {}) {
	try {
		return await hostExecFile("sudo", ["-n", bin, ...args], opts);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("password is required") || message.includes("a password is required") || message.includes("not in the sudoers")) {
			throw new Error(`Dashboard service user cannot run ${bin} through passwordless sudo. Install the required sudoers rule or apply the update from the host shell.`);
		}
		throw error;
	}
}

async function listAptUpdates(): Promise<UpdateItem[]> {
	try {
		const { stdout } = await hostExecFile("apt", ["list", "--upgradable"], { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 });
		const updates: UpdateItem[] = [];
		for (const line of stdout.split("\n").slice(1)) {
			const match = line.match(/^([^/]+)\/\S+\s+(\S+)\s+\S+\s+\[upgradable from:\s+([^\]]+)\]/);
			if (!match) continue;
			const [, name, latestVersion, currentVersion] = match;
			updates.push({ id: `apt:${name}`, manager: "apt", name, currentVersion, latestVersion, description: "System package", restartServices: restartServicesForPackage("apt", name) });
		}
		return updates;
	} catch {
		return [];
	}
}

async function listNpmUpdates(): Promise<UpdateItem[]> {
	try {
		const npmBin = await findNpmBin();
		if (!npmBin) return [];
		const { stdout } = await hostExecFile(npmBin, ["outdated", "-g", "--json"], { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 });
		return parseNpmOutdated(stdout);
	} catch (error) {
		const stdout = outputFromExecError(error);
		if (stdout.trim()) {
			try {
				return parseNpmOutdated(stdout);
			} catch {
				return [];
			}
		}
		return [];
	}
}

export async function GET(request: Request) {
	const auth = await requireAdmin(request, { tool: "updates.list" });
	if (auth.error) return auth.error;

	const [apt, npm] = await Promise.all([listAptUpdates(), listNpmUpdates()]);
	return NextResponse.json({ updates: [...apt, ...npm], timestamp: Date.now() });
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "updates.apply" });
	if (auth.error) return auth.error;

	let manager = "";
	let name = "";
	let restartServices: string[] = [];
	try {
		const body = await request.json();
		manager = String(body.manager || "").trim().toLowerCase();
		name = String(body.name || "").trim();
		const requestedRestartServices = Array.isArray(body.restartServices)
			? body.restartServices.map((service: unknown) => String(service).trim()).filter(Boolean)
			: String(body.restartService || "")
				.split(",")
				.map((service) => service.trim())
				.filter(Boolean);
		restartServices = requestedRestartServices.length > 0
			? requestedRestartServices
			: restartServicesForPackage(manager as UpdateItem["manager"], name);

		if (!["apt", "npm"].includes(manager)) return NextResponse.json({ error: "Invalid package manager" }, { status: 400 });
		if (!validPackageName(name)) return NextResponse.json({ error: "Invalid package name" }, { status: 400 });
		if (restartServices.some((service) => !validServiceName(service))) return NextResponse.json({ error: "Invalid service name" }, { status: 400 });

		const command = manager === "apt"
			? { bin: "apt-get", args: ["install", "--only-upgrade", "-y", "-o", "Dpkg::Options::=--force-confold", name], sudo: true }
			: { bin: await findNpmBin(), args: ["i", "-g", `${name}@latest`, "--prefer-online"], sudo: true };
		if (!command.bin) return NextResponse.json({ error: `${manager} executable was not found on the host` }, { status: 424 });
		const updated = command.sudo
			? await sudoHostExecFile(command.bin, command.args, { timeout: 10 * 60_000, maxBuffer: 20 * 1024 * 1024 })
			: await hostExecFile(command.bin, command.args, { timeout: 10 * 60_000, maxBuffer: 20 * 1024 * 1024 });
		const restarts: Array<{ service: string; stdout: string; stderr: string }> = [];
		for (const service of restartServices) {
			const restart = await sudoHostExecFile("systemctl", ["restart", service], { timeout: 60_000, maxBuffer: 5 * 1024 * 1024 });
			restarts.push({ service, stdout: restart.stdout, stderr: restart.stderr });
		}

		await createActionLog({
			user_id: auth.session?.user_id ?? null,
			username: auth.session?.username ?? null,
			target_type: "updates",
			target_name: `${manager}:${name}`,
			action: restartServices.length > 0 ? `update+restart:${restartServices.join(",")}` : "update",
			status: "success",
			message: updated.stderr || updated.stdout || restarts.map((restart) => restart.stderr || restart.stdout).filter(Boolean).join("\n") || null,
		});

		return NextResponse.json({ success: true, stdout: updated.stdout, stderr: updated.stderr, restarts });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Update failed";
		await createActionLog({
			user_id: auth.session?.user_id ?? null,
			username: auth.session?.username ?? null,
			target_type: "updates",
			target_name: name ? `${manager}:${name}` : "unknown",
			action: restartServices.length > 0 ? `update+restart:${restartServices.join(",")}` : "update",
			status: "failure",
			message,
		}).catch(() => {});
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
