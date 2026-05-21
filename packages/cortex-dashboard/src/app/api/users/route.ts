import { NextResponse } from "next/server";
import { authenticateUser, requireAdmin } from "@/lib/auth";
import { listPamUsers, listActiveSessions, deleteUserSessions } from "@/lib/db/admin";
import { createActionLog } from "@/lib/db/action-log";
import { hostExecFile } from "@/lib/host-exec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_USERNAME_RE = /^[a-z_][a-z0-9_-]{0,31}$/;

interface LocalUser {
	username: string;
	uid: number;
	gid: number;
	home: string;
	shell: string;
	isAdmin: boolean;
	isLocked: boolean;
}

function isValidUsername(username: string) {
	return SAFE_USERNAME_RE.test(username);
}

async function sudoExec(adminPassword: string, bin: string, args: string[]) {
	return hostExecFile("bash", ["-lc", 'printf \'%s\\n\' "$1" | sudo -S -p \'\' "$2" "${@:3}"', "sudo-exec", adminPassword, bin, ...args], {
		timeout: 30_000,
		maxBuffer: 1024 * 1024,
	});
}

function parsePasswd(stdout: string): LocalUser[] {
	return stdout
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			const [username, , uidRaw, gidRaw, , home, shell] = line.split(":");
			return { username, uid: Number(uidRaw), gid: Number(gidRaw), home, shell, isAdmin: false, isLocked: false };
		})
		.filter((user) => user.uid >= 1000 || user.username === "root");
}

async function listLocalUsers(): Promise<LocalUser[]> {
	const [{ stdout: passwd }, { stdout: sudoGroup }, { stdout: cortexosAdminGroup }, shadow] = await Promise.all([
		hostExecFile("getent", ["passwd"], { timeout: 10_000 }),
		hostExecFile("getent", ["group", "sudo"], { timeout: 10_000 }).catch(() => ({ stdout: "", stderr: "" })),
		hostExecFile("getent", ["group", "cortexos-admin"], { timeout: 10_000 }).catch(() => ({ stdout: "", stderr: "" })),
		hostExecFile("passwd", ["-S", "-a"], { timeout: 10_000 }).catch(() => ({ stdout: "", stderr: "" })),
	]);
	const sudoUsers = new Set(sudoGroup.split(":")[3]?.split(",").filter(Boolean) ?? []);
	const cortexosAdminUsers = new Set(cortexosAdminGroup.split(":")[3]?.split(",").filter(Boolean) ?? []);
	const lockState = new Map<string, boolean>();
	for (const line of shadow.stdout.split("\n")) {
		const [username, state] = line.trim().split(/\s+/);
		if (username) lockState.set(username, state === "L" || state === "LK");
	}
	return parsePasswd(passwd).map((user) => ({
		...user,
		isAdmin: user.username === "root" || sudoUsers.has(user.username) || cortexosAdminUsers.has(user.username),
		isLocked: lockState.get(user.username) ?? false,
	}));
}

export async function GET(request: Request) {
	const auth = await requireAdmin(request, { tool: "users.list" });
	if (auth.error) return auth.error;

	try {
		const [users, sessions, localUsers] = await Promise.all([listPamUsers(), listActiveSessions(), listLocalUsers()]);
		return NextResponse.json({ users, sessions, localUsers });
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "users.local.create" });
	if (auth.error) return auth.error;

	const body = await request.json().catch(() => ({}));
	const username = String(body.username || "").trim();
	const password = String(body.password || "");
	const adminPassword = String(body.adminPassword || "");
	if (!isValidUsername(username)) return NextResponse.json({ error: "Invalid username" }, { status: 400 });
	if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
	if (!adminPassword) return NextResponse.json({ error: "Admin password is required" }, { status: 400 });

	const adminUser = auth.session?.username ? await authenticateUser(auth.session.username, adminPassword) : null;
	if (!adminUser?.is_admin) return NextResponse.json({ error: "Invalid admin password" }, { status: 403 });

	try {
		await sudoExec(adminPassword, "useradd", ["-m", "-s", "/bin/bash", username]);
		await hostExecFile("sh", ["-c", `printf '%s\\n' "$1" | sudo -S -p '' sh -c 'printf \"%s:%s\\\\n\" \"$1\" \"$2\" | chpasswd' set-password "$2" "$3"`, "sudo-set-password", adminPassword, username, password], { timeout: 30_000 }).catch(async (error) => {
			await sudoExec(adminPassword, "userdel", ["-r", username]).catch(() => {});
			throw error;
		});
		await createActionLog({ user_id: auth.session?.user_id ?? null, username: auth.session?.username ?? null, target_type: "local-user", target_name: username, action: "create", status: "success", message: "Created user" });
		return NextResponse.json({ success: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to create user";
		await createActionLog({ user_id: auth.session?.user_id ?? null, username: auth.session?.username ?? null, target_type: "local-user", target_name: username, action: "create", status: "failure", message }).catch(() => {});
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function PATCH(request: Request) {
	const auth = await requireAdmin(request, { tool: "users.local.update" });
	if (auth.error) return auth.error;

	const body = await request.json().catch(() => ({}));
	const username = String(body.username || "").trim();
	const action = String(body.action || "").trim();
	if (!isValidUsername(username)) return NextResponse.json({ error: "Invalid username" }, { status: 400 });
	if (username === "root" && ["lock", "remove-admin"].includes(action)) return NextResponse.json({ error: "Refusing this action for root" }, { status: 400 });

	const commands: Record<string, [string, string[]]> = {
		lock: ["passwd", ["-l", username]],
		unlock: ["passwd", ["-u", username]],
		"add-admin": ["usermod", ["-aG", "sudo,cortexos-admin", username]],
		"remove-admin": ["gpasswd", ["-d", username, "sudo"]],
	};
	const command = commands[action];
	if (!command) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

	try {
		const [bin, args] = command;
		const result = await hostExecFile(bin, args, { timeout: 30_000, maxBuffer: 1024 * 1024 });
		if (action === "remove-admin") await hostExecFile("gpasswd", ["-d", username, "cortexos-admin"], { timeout: 30_000 }).catch(() => {});
		await createActionLog({ user_id: auth.session?.user_id ?? null, username: auth.session?.username ?? null, target_type: "local-user", target_name: username, action, status: "success", message: result.stderr || result.stdout || null });
		return NextResponse.json({ success: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to update user";
		await createActionLog({ user_id: auth.session?.user_id ?? null, username: auth.session?.username ?? null, target_type: "local-user", target_name: username, action, status: "failure", message }).catch(() => {});
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const auth = await requireAdmin(request, { tool: "users.manage" });
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const username = searchParams.get("username")?.trim();
	if (username) {
		if (!isValidUsername(username)) return NextResponse.json({ error: "Invalid username", code: "EVALIDATION" }, { status: 400 });
		if (username === "root") return NextResponse.json({ error: "Refusing to delete root", code: "EVALIDATION" }, { status: 400 });
		try {
			const result = await hostExecFile("userdel", ["-r", username], { timeout: 30_000, maxBuffer: 1024 * 1024 });
			await createActionLog({ user_id: auth.session?.user_id ?? null, username: auth.session?.username ?? null, target_type: "local-user", target_name: username, action: "delete", status: "success", message: result.stderr || result.stdout || null });
			return NextResponse.json({ success: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to delete user";
			await createActionLog({ user_id: auth.session?.user_id ?? null, username: auth.session?.username ?? null, target_type: "local-user", target_name: username, action: "delete", status: "failure", message }).catch(() => {});
			return NextResponse.json({ error: message }, { status: 500 });
		}
	}

	const userId = Number(searchParams.get("userId"));
	if (!Number.isInteger(userId) || userId <= 0) {
		return NextResponse.json({ error: "valid userId or username query param required", code: "EVALIDATION" }, { status: 400 });
	}

	try {
		await deleteUserSessions(userId);
		return NextResponse.json({ success: true });
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
