"use client";

import * as React from "react";
import useSWR from "swr";
import { Lock, LockOpen, Shield, ShieldOff, Trash2, UserPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface LocalUser {
	username: string;
	uid: number;
	gid: number;
	home: string;
	shell: string;
	isAdmin: boolean;
	isLocked: boolean;
}

interface PamUser {
	id: number;
	username: string;
	created_at: string;
	last_login_at: string | null;
	active_sessions: number;
	last_expires_at: string | null;
}

interface ActiveSession {
	id: number;
	username: string;
	created_at: string;
	expires_at: string;
	is_admin: boolean;
}

interface UsersData {
	localUsers: LocalUser[];
	users: PamUser[];
	sessions: ActiveSession[];
}

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((res) => res.json());

export function UsersAdminPanel({ initialUsers, initialSessions }: { initialUsers: PamUser[]; initialSessions: ActiveSession[] }) {
	const { data, mutate } = useSWR<UsersData>("/api/users", fetcher, {
		fallbackData: { localUsers: [], users: initialUsers, sessions: initialSessions },
		refreshInterval: 10_000,
	});
	const [username, setUsername] = React.useState("");
	const [password, setPassword] = React.useState("");
	const [admin, setAdmin] = React.useState(false);
	const [running, setRunning] = React.useState<string | null>(null);
	const [message, setMessage] = React.useState<string | null>(null);
	const localUsers = data?.localUsers ?? [];
	const users = data?.users ?? [];
	const sessions = data?.sessions ?? [];

	async function run(label: string, request: () => Promise<Response>) {
		setRunning(label);
		setMessage(null);
		try {
			const res = await request();
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
			setMessage("User action completed.");
			await mutate();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "User action failed");
		} finally {
			setRunning(null);
		}
	}

	async function createUser(event: React.FormEvent) {
		event.preventDefault();
		await run("create", () => fetch("/api/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password, admin }),
		}));
		setUsername("");
		setPassword("");
		setAdmin(false);
	}

	return (
		<div className="space-y-6">
			<form onSubmit={createUser} className="rounded-lg border border-border p-4">
				<div className="mb-3 flex items-center justify-between gap-3">
					<div>
						<h2 className="text-lg font-semibold">Create Local User</h2>
						<p className="text-sm text-muted-foreground">Creates a Linux account on this machine.</p>
					</div>
					<Button type="button" variant="outline" onClick={() => mutate()}><RefreshCw className="size-4" />Refresh</Button>
				</div>
				<div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-center">
					<Input placeholder="username" value={username} onChange={(event) => setUsername(event.target.value)} />
					<Input placeholder="temporary password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
					<label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={admin} onChange={(event) => setAdmin(event.target.checked)} /> Admin</label>
					<Button type="submit" disabled={running !== null}><UserPlus className="size-4" />Create</Button>
				</div>
			</form>
			{message && <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{message}</p>}
			<section className="space-y-2">
				<h2 className="text-lg font-semibold">Local Machine Users</h2>
				<div className="overflow-hidden rounded-lg border border-border">
					<Table>
						<TableHeader><TableRow><TableHead>User</TableHead><TableHead>UID</TableHead><TableHead>Home</TableHead><TableHead>Shell</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
						<TableBody>
							{localUsers.length === 0 ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No local users loaded.</TableCell></TableRow> : localUsers.map((user) => (
								<TableRow key={user.username}>
									<TableCell className="font-mono text-xs">{user.username}</TableCell>
									<TableCell className="font-mono text-xs">{user.uid}</TableCell>
									<TableCell className="font-mono text-xs">{user.home}</TableCell>
									<TableCell className="font-mono text-xs">{user.shell}</TableCell>
									<TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.isLocked ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>{user.isLocked ? "Locked" : "Active"}</span>{user.isAdmin && <span className="ml-2 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-400">Admin</span>}</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-1">
											<Button size="icon-sm" variant="outline" title={user.isLocked ? "Unlock" : "Lock"} disabled={running !== null || user.username === "root"} onClick={() => run(`${user.username}:lock`, () => fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: user.username, action: user.isLocked ? "unlock" : "lock" }) }))}>{user.isLocked ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}</Button>
											<Button size="icon-sm" variant="outline" title={user.isAdmin ? "Remove admin" : "Make admin"} disabled={running !== null || user.username === "root"} onClick={() => run(`${user.username}:admin`, () => fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: user.username, action: user.isAdmin ? "remove-admin" : "add-admin" }) }))}>{user.isAdmin ? <ShieldOff className="size-3.5" /> : <Shield className="size-3.5" />}</Button>
											<Button size="icon-sm" variant="destructive" title="Delete local user" disabled={running !== null || user.username === "root"} onClick={() => run(`${user.username}:delete`, () => fetch(`/api/users?username=${encodeURIComponent(user.username)}`, { method: "DELETE" }))}><Trash2 className="size-3.5" /></Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</section>
			<section className="space-y-2">
				<h2 className="text-lg font-semibold">Dashboard Sessions</h2>
				<div className="overflow-hidden rounded-lg border border-border">
					<Table>
						<TableHeader><TableRow><TableHead>User</TableHead><TableHead>Created</TableHead><TableHead>Expires</TableHead><TableHead>Admin</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
						<TableBody>
							{sessions.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No active sessions.</TableCell></TableRow> : sessions.map((session) => {
								const pam = users.find((user) => user.username === session.username);
								return <TableRow key={session.id}><TableCell className="font-mono text-xs">{session.username}</TableCell><TableCell>{new Date(session.created_at).toLocaleString()}</TableCell><TableCell>{new Date(session.expires_at).toLocaleString()}</TableCell><TableCell>{session.is_admin ? "Yes" : "No"}</TableCell><TableCell className="text-right">{pam && <Button size="sm" variant="outline" disabled={running !== null} onClick={() => run(`revoke:${pam.id}`, () => fetch(`/api/users?userId=${pam.id}`, { method: "DELETE" }))}>Revoke</Button>}</TableCell></TableRow>;
							})}
						</TableBody>
					</Table>
				</div>
			</section>
		</div>
	);
}
