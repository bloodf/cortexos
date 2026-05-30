"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";

interface UserRow {
	id: number;
	username: string;
	created_at: string;
	active_sessions?: number;
	last_login_at?: string | null;
}

interface Props {
	initialUsers: UserRow[];
}

// Read-only view: PAM-backed accounts are managed on the host, not the
// dashboard. The dashboard only records users that have authenticated.
export function AdminUsersPanel({ initialUsers }: Props) {
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
				accessorKey: "active_sessions",
				header: "Active sessions",
				cell: ({ row }) => row.original.active_sessions ?? 0,
			},
			{
				accessorKey: "last_login_at",
				header: "Last login",
				cell: ({ row }) =>
					row.original.last_login_at
						? new Date(row.original.last_login_at).toLocaleString()
						: "—",
			},
			{
				accessorKey: "created_at",
				header: "First seen",
				cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
			},
		],
		[],
	);

	return (
		<div className="space-y-3">
			{initialUsers.length === 0 ? (
				<EmptyState
					title="No users yet"
					description="Users appear here after they log in with a host system account."
				/>
			) : (
				<DataTable columns={columns} data={initialUsers} />
			)}
		</div>
	);
}
