import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listPamUsers } from "@/lib/db/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAM_MESSAGE =
	"User accounts are managed by Linux PAM on the host. Create or remove accounts and change passwords with passwd or SSH. The dashboard only tracks users that have logged in.";

// Read-only listing of PAM-backed users that have authenticated against the
// dashboard. Mutation is not possible because credentials live in the host
// OS, not in the database.
export async function GET(request: Request) {
	const auth = await requireAdmin(request, { tool: "admin.user.list" });
	if (auth.error) return auth.error;

	const users = await listPamUsers();
	return NextResponse.json({
		users: users.map((u) => ({
			id: u.id,
			username: u.username,
			created_at: u.created_at.toISOString(),
			active_sessions: u.active_sessions,
			last_login_at: u.last_login_at ? new Date(u.last_login_at).toISOString() : null,
		})),
	});
}

// Account lifecycle is owned by the host OS under PAM auth.
export async function POST() {
	return NextResponse.json({ error: PAM_MESSAGE }, { status: 405 });
}

export async function PATCH() {
	return NextResponse.json({ error: PAM_MESSAGE }, { status: 405 });
}

export async function DELETE() {
	return NextResponse.json({ error: PAM_MESSAGE }, { status: 405 });
}
