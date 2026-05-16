import { NextResponse } from "next/server";
import { hostExecFile } from "@/lib/host-exec";
import { requireAdmin } from "@/lib/auth";
import { createActionLog } from "@/lib/db/action-log";

const VALID_ACTIONS = new Set(["start", "stop", "restart"]);

// systemd units: e.g. docker.service, ssh.service, foo@bar.service
const SAFE_NAME_RE = /^[a-zA-Z0-9_.@:-]+$/;

function isValidName(name: string): boolean {
	return SAFE_NAME_RE.test(name);
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "systemd.action" });
	if (auth.error) return auth.error;

	try {
		const body = await request.json();
		const action = String(body.action || "").trim().toLowerCase();
		const name = String(body.name || "").trim();

		if (!action || !VALID_ACTIONS.has(action)) {
			return NextResponse.json({ error: "Invalid action" }, { status: 400 });
		}
		if (!name || !isValidName(name)) {
			return NextResponse.json({ error: "Invalid name" }, { status: 400 });
		}

		const { stdout, stderr } = await hostExecFile("systemctl", [action, name], {
			timeout: 30000,
			maxBuffer: 5 * 1024 * 1024,
		});

		await createActionLog({
			user_id: auth.session?.user_id ?? null,
			username: auth.session?.username ?? null,
			target_type: "systemd",
			target_name: name,
			action,
			status: "success",
			message: stderr || stdout || null,
		});

		return NextResponse.json({ success: true, stdout, stderr });
	} catch (e) {
		const msg = e instanceof Error ? e.message : "systemctl command failed";

		try {
			const body = await request.json().catch(() => ({} as Record<string, unknown>));
			const action = String(body.action || "").trim().toLowerCase();
			const name = String(body.name || "").trim();
			if (action && name) {
				await createActionLog({
					user_id: auth.session?.user_id ?? null,
					username: auth.session?.username ?? null,
					target_type: "systemd",
					target_name: name,
					action,
					status: "failure",
					message: msg,
				});
			}
		} catch {
			// ignore logging failure
		}

		return NextResponse.json({ error: msg }, { status: 500 });
	}
}

export const dynamic = "force-dynamic";
