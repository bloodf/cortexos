import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createActionLog } from "@/lib/db/action-log";
import { executeRootCommand } from "@/lib/root-helper/executor";

const SAFE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/;

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
	const auth = await requireAdmin(request, { tool: "incus.shell" });
	if (auth.error) return auth.error;

	const { name } = await params;
	if (!SAFE_NAME_RE.test(name)) {
		return NextResponse.json({ error: "Invalid instance name" }, { status: 400 });
	}

	try {
		const body = await request.json();
		const command = String(body.command || "").trim();

		if (!command) {
			return NextResponse.json({ error: "Command is required" }, { status: 400 });
		}

		const { stdout, stderr } = await executeRootCommand({
			command: "incus",
			argv: ["exec", name, "--", "sh", "-c", command],
			timeoutMs: 30000,
			requestedBy: auth.session?.username ?? "trusted-dashboard",
			dashboardSessionId: auth.session ? `user-${auth.session.user_id}` : null,
			mutationClass: "incus-shell",
			targetScope: "host",
			metadata: { route: "/api/incus/shell", name, command },
		});

		await createActionLog({
			user_id: auth.session?.user_id ?? null,
			username: auth.session?.username ?? null,
			target_type: "incus",
			target_name: name,
			action: "shell",
			status: "success",
			message: stderr || stdout || null,
		});

		return NextResponse.json({ success: true, stdout, stderr });
	} catch (e) {
		const msg = e instanceof Error ? e.message : "incus shell failed";

		await createActionLog({
			user_id: auth.session?.user_id ?? null,
			username: auth.session?.username ?? null,
			target_type: "incus",
			target_name: name,
			action: "shell",
			status: "failure",
			message: msg,
		}).catch(() => {});

		return NextResponse.json({ error: msg }, { status: 500 });
	}
}

export const dynamic = "force-dynamic";
