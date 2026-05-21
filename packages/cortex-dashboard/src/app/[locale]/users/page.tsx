import { listPamUsers, listActiveSessions } from "@/lib/db/admin";
import { UsersAdminPanel } from "@/components/admin/users-admin-panel";

export default async function UsersPage() {
	const [users, sessions] = await Promise.all([listPamUsers(), listActiveSessions()]);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Users</h1>
				<p className="text-sm text-muted-foreground">Local machine users, PAM-authenticated dashboard users, and active admin sessions.</p>
			</div>
			<UsersAdminPanel initialUsers={users.map((user) => ({ ...user, created_at: user.created_at.toISOString(), last_login_at: user.last_login_at?.toISOString() ?? null, last_expires_at: user.last_expires_at?.toISOString() ?? null }))} initialSessions={sessions.map((session) => ({ ...session, created_at: session.created_at.toISOString(), expires_at: session.expires_at.toISOString() }))} />
		</div>
	);
}

export const dynamic = "force-dynamic";
