import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createActionLog } from "@/lib/db/action-log";
import { executeRootCommand } from "@/lib/root-helper/executor";

const VALID_ACTIONS = new Set(["start", "stop", "restart", "delete"]);

// Incus instance names: alphanumeric, hyphen, underscore; must start with letter
const SAFE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/;

function isValidName(name: string): boolean {
	return SAFE_NAME_RE.test(name);
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "incus.action" });
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

		if (action === "delete") {
			const confirm = request.headers.get("x-incus-delete-confirm");
			if (confirm !== "true") {
				return NextResponse.json(
					{ error: "Delete requires x-incus-delete-confirm: true header" },
					{ status: 400 },
				);
			}
		}

		const args = [action, name];
		if (action === "delete") {
			args.push("--force");
		}

		const { stdout, stderr } = await executeRootCommand({
			command: "incus",
			argv: args,
			timeoutMs: action === "delete" ? 60000 : 30000,
			requestedBy: auth.session?.username ?? "trusted-dashboard",
			dashboardSessionId: auth.session ? `user-${auth.session.user_id}` : null,
			mutationClass: "incus-control",
			targetScope: "host",
			metadata: { route: "/api/incus/actions", name, action },
		});

		await createActionLog({
			user_id: auth.session?.user_id ?? null,
			username: auth.session?.username ?? null,
			target_type: "incus",
			target_name: name,
			action,
			status: "success",
			message: stderr || stdout || null,
		});

		return NextResponse.json({ success: true, stdout, stderr });
	} catch (e) {
		const msg = e instanceof Error ? e.message : "incus action failed";

		try {
			const body = await request.json().catch(() => ({} as Record<string, unknown>));
			const action = String(body.action || "").trim().toLowerCase();
			const name = String(body.name || "").trim();
			if (action && name) {
				await createActionLog({
					user_id: auth.session?.user_id ?? null,
					username: auth.session?.username ?? null,
					target_type: "incus",
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
