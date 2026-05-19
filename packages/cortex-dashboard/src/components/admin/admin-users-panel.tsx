"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus } from "lucide-react";

interface UserRow {
	id: number;
	username: string;
	created_at: string;
}

interface Props {
	initialUsers: UserRow[];
}

const USERNAME_RE = /^[a-zA-Z0-9_][a-zA-Z0-9_-]{2,31}$/;

export function AdminUsersPanel({ initialUsers }: Props) {
	const [users, setUsers] = React.useState(initialUsers);
	const [creating, setCreating] = React.useState(false);
	const [err, setErr] = React.useState<string | null>(null);

	async function create(username: string, password: string) {
		setErr(null);
		const res = await fetch("/api/admin/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password }),
		});
		if (!res.ok) {
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			setErr(body.error ?? `HTTP ${res.status}`);
			return;
		}
		const data = (await res.json()) as { user: UserRow };
		setUsers((prev) => [...prev, data.user]);
		setCreating(false);
	}

	async function resetPassword(id: number) {
		const password = window.prompt("New password (min 12 chars):");
		if (!password || password.length < 12) {
			setErr("Password must be at least 12 chars");
			return;
		}
		setErr(null);
		const res = await fetch(`/api/admin/users?id=${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password }),
		});
		if (!res.ok) {
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			setErr(body.error ?? "Failed");
		}
	}

	async function remove(id: number, username: string) {
		const ok = window.confirm(`Delete user "${username}"? This cannot be undone.`);
		if (!ok) return;
		setErr(null);
		const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
		if (!res.ok) {
			const body = (await res.json().catch(() => ({}))) as { error?: string };
			setErr(body.error ?? "Failed");
			return;
		}
		setUsers((prev) => prev.filter((u) => u.id !== id));
	}

	const columns = React.useMemo<ColumnDef<UserRow>[]>(
		() => [
			{
				accessorKey: "username",
				header: "Username",
				cell: ({ row }) => (
					<span className="font-mono text-xs">{row.original.username}</span>
				),
			},
			{
				accessorKey: "created_at",
				header: "Created",
				cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<div className="flex gap-1">
						<Button
							size="sm"
							variant="ghost"
							onClick={() => resetPassword(row.original.id)}
						>
							Reset password
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => remove(row.original.id, row.original.username)}
						>
							Delete
						</Button>
					</div>
				),
			},
		],
		[],
	);

	return (
		<div className="space-y-3">
			{err && (
				<p className="text-sm text-destructive" role="alert">
					{err}
				</p>
			)}
			<div className="flex justify-end">
				<Button size="sm" onClick={() => setCreating(true)}>
					<Plus className="size-4 mr-1" /> New user
				</Button>
			</div>

			{users.length === 0 ? (
				<EmptyState
					title="No users"
					description="Create the first admin user."
				/>
			) : (
				<DataTable columns={columns} data={users} />
			)}

			{creating && (
				<UserEditor onClose={() => setCreating(false)} onCreate={create} />
			)}
		</div>
	);
}

function UserEditor({
	onClose,
	onCreate,
}: {
	onClose: () => void;
	onCreate: (username: string, password: string) => void;
}) {
	const [username, setUsername] = React.useState("");
	const [password, setPassword] = React.useState("");
	const usernameValid = USERNAME_RE.test(username);
	const passwordValid = password.length >= 12;

	return (
		<Dialog open onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create admin user</DialogTitle>
				</DialogHeader>
				<div className="space-y-3">
					<div>
						<label className="text-xs font-medium" htmlFor="username">
							Username
						</label>
						<Input
							id="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							placeholder="admin"
						/>
						{username && !usernameValid && (
							<p className="text-xs text-destructive mt-1">
								3–32 chars, alphanumeric/_/- only
							</p>
						)}
					</div>
					<div>
						<label className="text-xs font-medium" htmlFor="password">
							Password
						</label>
						<Input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="min 12 chars"
						/>
						{password && !passwordValid && (
							<p className="text-xs text-destructive mt-1">
								Password must be at least 12 chars
							</p>
						)}
					</div>
					<div className="flex justify-end gap-2 pt-2">
						<Button variant="outline" size="sm" onClick={onClose}>
							Cancel
						</Button>
						<Button
							size="sm"
							disabled={!usernameValid || !passwordValid}
							onClick={() => onCreate(username, password)}
						>
							Create
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
