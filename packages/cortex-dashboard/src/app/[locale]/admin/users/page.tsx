import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import { listPamUsers } from "@/lib/db/admin";

export default async function AdminUsersPage() {
	const users = await listPamUsers();
	const safe = users.map((u) => ({
		id: u.id,
		username: u.username,
		created_at: u.created_at.toISOString(),
		active_sessions: u.active_sessions,
		last_login_at: u.last_login_at ? new Date(u.last_login_at).toISOString() : null,
	}));
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Admin · Users</h1>
			<p className="text-sm text-muted-foreground">
				Users that have logged in via Linux PAM. Accounts and passwords are managed
				on the host (passwd, Cockpit, Webmin, SSH); admin access is granted via the
				cortexos-admin or sudo groups.
			</p>
			<AdminUsersPanel initialUsers={safe} />
		</div>
	);
}

export const dynamic = "force-dynamic";
