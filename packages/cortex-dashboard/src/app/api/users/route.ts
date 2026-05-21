import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listPamUsers, listActiveSessions, deleteUserSessions } from "@/lib/db/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const auth = await requireAdmin(request, { tool: "users.list" });
	if (auth.error) return auth.error;

	try {
		const [users, sessions] = await Promise.all([listPamUsers(), listActiveSessions()]);
		return NextResponse.json({ users, sessions });
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function DELETE(request: Request) {
	const auth = await requireAdmin(request, { tool: "users.sessions.revoke" });
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const userId = Number(searchParams.get("userId"));
	if (!Number.isInteger(userId) || userId <= 0) {
		return NextResponse.json({ error: "valid userId query param required", code: "EVALIDATION" }, { status: 400 });
	}

	try {
		await deleteUserSessions(userId);
		return NextResponse.json({ success: true });
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
