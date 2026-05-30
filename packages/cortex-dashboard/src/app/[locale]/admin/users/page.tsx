import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import { listPamUsers } from "@/lib/db/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Users } from "lucide-react";

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
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Users"
				description="Users that have logged in via Linux PAM. Accounts and passwords are managed on the host (passwd, Cockpit, Webmin, SSH); admin access is granted via the cortexos-admin or sudo groups."
				icon={<Users />}
			/>
			<AdminUsersPanel initialUsers={safe} />
		</div>
	);
}

export const dynamic = "force-dynamic";
