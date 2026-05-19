import { query } from "@/lib/db/client";
import { AdminUsersPanel } from "@/components/admin/admin-users-panel";

interface UserRow {
	id: number;
	username: string;
	created_at: Date;
}

export default async function AdminUsersPage() {
	const users = await query<UserRow>(
		"SELECT id, username, created_at FROM admin_users ORDER BY username",
	);
	const safe = users.map((u) => ({
		id: u.id,
		username: u.username,
		created_at: u.created_at.toISOString(),
	}));
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Admin · Users</h1>
			<p className="text-sm text-muted-foreground">
				Local admin accounts. Passwords are bcrypt-hashed and never displayed.
			</p>
			<AdminUsersPanel initialUsers={safe} />
		</div>
	);
}

export const dynamic = "force-dynamic";
