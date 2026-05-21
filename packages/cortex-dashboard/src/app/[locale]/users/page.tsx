import { listPamUsers, listActiveSessions } from "@/lib/db/admin";

export default async function UsersPage() {
	const [users, sessions] = await Promise.all([listPamUsers(), listActiveSessions()]);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Users</h1>
				<p className="text-sm text-muted-foreground">PAM-authenticated users and active admin sessions.</p>
			</div>
			<section className="rounded-lg border border-border overflow-hidden">
				<table className="w-full text-sm">
					<thead className="text-xs uppercase text-muted-foreground">
						<tr className="border-b border-border">
							<th className="px-3 py-2 text-left">User</th>
							<th className="px-3 py-2 text-left">Created</th>
							<th className="px-3 py-2 text-left">Last login</th>
							<th className="px-3 py-2 text-left">Active sessions</th>
							<th className="px-3 py-2 text-left">Session expiry</th>
						</tr>
					</thead>
					<tbody>
						{users.length === 0 ? (
							<tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No PAM users recorded.</td></tr>
						) : users.map((user) => (
							<tr key={user.id} className="border-b border-border last:border-0">
								<td className="px-3 py-2 font-mono text-xs">{user.username}</td>
								<td className="px-3 py-2 text-muted-foreground">{new Date(user.created_at).toLocaleString()}</td>
								<td className="px-3 py-2 text-muted-foreground">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "—"}</td>
								<td className="px-3 py-2">{user.active_sessions}</td>
								<td className="px-3 py-2 text-muted-foreground">{user.last_expires_at ? new Date(user.last_expires_at).toLocaleString() : "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
			</section>
			<section className="space-y-2">
				<h2 className="text-lg font-semibold">Active Sessions</h2>
				<div className="rounded-lg border border-border overflow-hidden">
					<table className="w-full text-sm">
						<thead className="text-xs uppercase text-muted-foreground"><tr className="border-b border-border"><th className="px-3 py-2 text-left">User</th><th className="px-3 py-2 text-left">Created</th><th className="px-3 py-2 text-left">Expires</th><th className="px-3 py-2 text-left">Admin</th></tr></thead>
						<tbody>{sessions.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No active sessions.</td></tr> : sessions.map((session) => <tr key={session.id} className="border-b border-border last:border-0"><td className="px-3 py-2 font-mono text-xs">{session.username}</td><td className="px-3 py-2 text-muted-foreground">{new Date(session.created_at).toLocaleString()}</td><td className="px-3 py-2 text-muted-foreground">{new Date(session.expires_at).toLocaleString()}</td><td className="px-3 py-2">{session.is_admin ? "Yes" : "No"}</td></tr>)}</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}

export const dynamic = "force-dynamic";
