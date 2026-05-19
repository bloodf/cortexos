import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin, hashPassword } from "@/lib/auth";
import {
	createUser,
	deleteUser,
	getUserById,
	updateUserPassword,
} from "@/lib/db/admin";
import { insertAuditRow } from "@/lib/db/agent-gateway-audit";

// L-6: args_hash must be a hash, not raw identifying data.
function argsHashOf(target: Record<string, unknown>): string {
	return createHash("sha256").update(JSON.stringify(target)).digest("hex");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-zA-Z0-9_][a-zA-Z0-9_-]{2,31}$/;

function audit(
	tool: string,
	actorUserId: number | null,
	argsHash: string,
	target: string,
	result: "ok" | "err" = "ok",
	reason?: string,
) {
	return insertAuditRow({
		actor_user_id: actorUserId,
		tool,
		tool_class: "privileged",
		args_hash: argsHash,
		decision: "allow",
		result,
		decision_reason: reason ? `${reason} target=${target}` : `target=${target}`,
	}).catch(() => {});
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "admin.user.create" });
	if (auth.error) return auth.error;

	try {
		const body = await request.json();
		const username = String(body.username ?? "").trim();
		const password = String(body.password ?? "");

		if (!USERNAME_RE.test(username)) {
			return NextResponse.json(
				{ error: "Invalid username (3-32 chars, alphanumeric/_/-)" },
				{ status: 400 },
			);
		}
		if (password.length < 12) {
			return NextResponse.json(
				{ error: "Password must be at least 12 chars" },
				{ status: 400 },
			);
		}

		const passwordHash = await hashPassword(password);
		const user = await createUser(username, passwordHash);
		await audit(
			"admin.user.create",
			auth.session?.user_id ?? null,
			argsHashOf({ username }),
			username,
		);

		return NextResponse.json(
			{
				user: {
					id: user.id,
					username: user.username,
					created_at: user.created_at.toISOString(),
				},
			},
			{ status: 201 },
		);
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Failed to create user";
		const status = msg.includes("duplicate") ? 409 : 500;
		return NextResponse.json({ error: msg }, { status });
	}
}

export async function PATCH(request: Request) {
	const auth = await requireAdmin(request, { tool: "admin.user.update" });
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const id = parseInt(searchParams.get("id") ?? "", 10);
	if (!Number.isInteger(id) || id < 1) {
		return NextResponse.json({ error: "Invalid id" }, { status: 400 });
	}

	try {
		const body = await request.json();
		const password = String(body.password ?? "");
		if (password.length < 12) {
			return NextResponse.json(
				{ error: "Password must be at least 12 chars" },
				{ status: 400 },
			);
		}
		const user = await getUserById(id);
		if (!user) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}
		const passwordHash = await hashPassword(password);
		await updateUserPassword(id, passwordHash);
		await audit(
			"admin.user.password",
			auth.session?.user_id ?? null,
			argsHashOf({ user_id: id }),
			String(id),
		);
		return NextResponse.json({ success: true });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Failed to update";
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const auth = await requireAdmin(request, { tool: "admin.user.delete" });
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const id = parseInt(searchParams.get("id") ?? "", 10);
	if (!Number.isInteger(id) || id < 1) {
		return NextResponse.json({ error: "Invalid id" }, { status: 400 });
	}
	if (auth.session?.user_id === id) {
		return NextResponse.json(
			{ error: "Cannot delete your own account" },
			{ status: 400 },
		);
	}

	try {
		await deleteUser(id);
		await audit(
			"admin.user.delete",
			auth.session?.user_id ?? null,
			argsHashOf({ user_id: id }),
			String(id),
		);
		return NextResponse.json({ success: true });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Failed to delete";
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}
