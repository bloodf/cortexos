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
	restartService?: string;
}

function validPackageName(name: string) {
	return SAFE_PACKAGE_RE.test(name);
}

function validServiceName(name: string) {
	return SAFE_SERVICE_RE.test(name);
}

async function listAptUpdates(): Promise<UpdateItem[]> {
	try {
		const { stdout } = await hostExecFile("apt", ["list", "--upgradable"], { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 });
		const updates: UpdateItem[] = [];
		for (const line of stdout.split("\n").slice(1)) {
			const match = line.match(/^([^/]+)\/\S+\s+(\S+)\s+\S+\s+\[upgradable from:\s+([^\]]+)\]/);
			if (!match) continue;
			const [, name, latestVersion, currentVersion] = match;
			updates.push({ id: `apt:${name}`, manager: "apt", name, currentVersion, latestVersion, description: "System package" });
		}
		return updates;
	} catch {
		return [];
	}
}

async function listNpmUpdates(): Promise<UpdateItem[]> {
	try {
		const { stdout } = await hostExecFile("npm", ["outdated", "-g", "--json"], { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 });
		if (!stdout.trim()) return [];
		const parsed = JSON.parse(stdout) as Record<string, { current?: string; wanted?: string; latest?: string }>;
		return Object.entries(parsed).map(([name, info]) => ({
			id: `npm:${name}`,
			manager: "npm",
			name,
			currentVersion: info.current,
			latestVersion: info.latest ?? info.wanted,
			description: "Global npm package",
		}));
	} catch (error) {
		const message = error instanceof Error ? error.message : "";
		if (message.includes("Command failed")) return [];
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
	let restartService = "";
	try {
		const body = await request.json();
		manager = String(body.manager || "").trim().toLowerCase();
		name = String(body.name || "").trim();
		restartService = String(body.restartService || "").trim();

		if (!["apt", "npm"].includes(manager)) return NextResponse.json({ error: "Invalid package manager" }, { status: 400 });
		if (!validPackageName(name)) return NextResponse.json({ error: "Invalid package name" }, { status: 400 });
		if (restartService && !validServiceName(restartService)) return NextResponse.json({ error: "Invalid service name" }, { status: 400 });

		const command = manager === "apt"
			? { bin: "apt-get", args: ["install", "--only-upgrade", "-y", name] }
			: { bin: "npm", args: ["i", "-g", `${name}@latest`, "--prefer-online"] };
		const updated = await hostExecFile(command.bin, command.args, { timeout: 10 * 60_000, maxBuffer: 20 * 1024 * 1024 });
		let restart: { stdout: string; stderr: string } | null = null;
		if (restartService) restart = await hostExecFile("systemctl", ["restart", restartService], { timeout: 60_000, maxBuffer: 5 * 1024 * 1024 });

		await createActionLog({
			user_id: auth.session?.user_id ?? null,
			username: auth.session?.username ?? null,
			target_type: "updates",
			target_name: `${manager}:${name}`,
			action: restartService ? `update+restart:${restartService}` : "update",
			status: "success",
			message: updated.stderr || updated.stdout || restart?.stderr || restart?.stdout || null,
		});

		return NextResponse.json({ success: true, stdout: updated.stdout, stderr: updated.stderr, restart });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Update failed";
		await createActionLog({
			user_id: auth.session?.user_id ?? null,
			username: auth.session?.username ?? null,
			target_type: "updates",
			target_name: name ? `${manager}:${name}` : "unknown",
			action: "update",
			status: "failure",
			message,
		}).catch(() => {});
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
