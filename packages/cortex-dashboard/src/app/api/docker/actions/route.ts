import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createActionLog } from "@/lib/db/action-log";
import { executeRootCommand } from "@/lib/root-helper/executor";

const VALID_ACTIONS = new Set(["start", "stop", "restart", "pull", "prune"]);
const VALID_PRUNE_TARGETS = new Set([
	"containers",
	"images",
	"volumes",
	"networks",
]);

// Allow image names like ghcr.io/org/image:tag and container names
const SAFE_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.:/@-]{0,255}$/;

function isValidName(name: string): boolean {
	return SAFE_NAME_RE.test(name);
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "docker.action" });
	if (auth.error) return auth.error;

	try {
		const body = await request.json();
		const action = String(body.action || "").trim().toLowerCase();
		const name = String(body.name || "").trim();

		if (!action || !VALID_ACTIONS.has(action)) {
			return NextResponse.json({ error: "Invalid action" }, { status: 400 });
		}

		// Prune does not take a container/image name — it takes a target ("containers", "images", ...).
		if (action === "prune") {
			const target = String(body.target || "").trim().toLowerCase();
			if (!VALID_PRUNE_TARGETS.has(target)) {
				return NextResponse.json({ error: "Invalid prune target" }, { status: 400 });
			}
			const { stdout, stderr } = await executeRootCommand({
				command: "docker",
				argv: [target.replace(/s$/, ""), "prune", "-f"],
				timeoutMs: 60000,
				requestedBy: auth.session?.username ?? "trusted-dashboard",
				dashboardSessionId: auth.session ? `user-${auth.session.user_id}` : null,
				mutationClass: "docker-prune",
				targetScope: "host",
				metadata: { route: "/api/docker/actions", target, action: "prune" },
			});
			await createActionLog({
				user_id: auth.session?.user_id ?? null,
				username: auth.session?.username ?? null,
				target_type: "docker",
				target_name: target,
				action: "prune",
				status: "success",
				message: stderr || stdout || null,
			});
			return NextResponse.json({ success: true, stdout, stderr });
		}

		if (!name || !isValidName(name)) {
			return NextResponse.json({ error: "Invalid name" }, { status: 400 });
		}

		const args = [action, name];
		const { stdout, stderr } = await executeRootCommand({
			command: "docker",
			argv: args,
			timeoutMs: 30000,
			requestedBy: auth.session?.username ?? "trusted-dashboard",
			dashboardSessionId: auth.session ? `user-${auth.session.user_id}` : null,
			mutationClass: "docker-control",
			targetScope: "host",
			metadata: { route: "/api/docker/actions", name, action },
		});

		await createActionLog({
			user_id: auth.session?.user_id ?? null,
			username: auth.session?.username ?? null,
			target_type: "docker",
			target_name: name,
			action,
			status: "success",
			message: stderr || stdout || null,
		});

		return NextResponse.json({ success: true, stdout, stderr });
	} catch (e) {
		const msg = e instanceof Error ? e.message : "docker command failed";

		try {
			const body = await request.json().catch(() => ({} as Record<string, unknown>));
			const action = String(body.action || "").trim().toLowerCase();
			const name = String(body.name || "").trim();
			if (action && name) {
				await createActionLog({
					user_id: auth.session?.user_id ?? null,
					username: auth.session?.username ?? null,
					target_type: "docker",
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
