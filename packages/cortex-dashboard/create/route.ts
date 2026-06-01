import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createActionLog } from "@/lib/db/action-log";
import { executeRootCommand } from "@/lib/root-helper/executor";

const SAFE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/;

function isValidName(name: string): boolean {
	return SAFE_NAME_RE.test(name);
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "incus.create" });
	if (auth.error) return auth.error;

	try {
		const body = await request.json();
		const name = String(body.name || "").trim();
		const image = String(body.image || "").trim();
		const profiles = Array.isArray(body.profiles) ? body.profiles : ["default"];

		if (!name || !isValidName(name)) {
			return NextResponse.json({ error: "Invalid name" }, { status: 400 });
		}
		if (!image) {
			return NextResponse.json({ error: "Image is required" }, { status: 400 });
		}

		const argv = ["launch", image, name];
		for (const p of profiles) {
			if (typeof p === "string" && p.length > 0) {
				argv.push("--profile", p);
			}
		}

		const { stdout, stderr } = await executeRootCommand({
			command: "incus",
			argv,
			timeoutMs: 120000,
			requestedBy: auth.session?.username ?? "trusted-dashboard",
			dashboardSessionId: auth.session ? `user-${auth.session.user_id}` : null,
			mutationClass: "incus-create",
			targetScope: "host",
			metadata: { route: "/api/incus/create", name, image, profiles },
		});

		await createActionLog({
			user_id: auth.session?.user_id ?? null,
			username: auth.session?.username ?? null,
			target_type: "incus",
			target_name: name,
			action: "create",
			status: "success",
			message: stderr || stdout || null,
		});

		return NextResponse.json({ success: true, stdout, stderr });
	} catch (e) {
		const msg = e instanceof Error ? e.message : "incus create failed";

		try {
			const body = await request.json().catch(() => ({} as Record<string, unknown>));
			const name = String(body.name || "").trim();
			if (name) {
				await createActionLog({
					user_id: auth.session?.user_id ?? null,
					username: auth.session?.username ?? null,
					target_type: "incus",
					target_name: name,
					action: "create",
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
