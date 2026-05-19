"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";

export interface AdminServiceRow {
	id: number;
	slug: string;
	name: string;
	kind: string;
	status: string;
	env_source: string | null;
	is_active: boolean;
	badges: { id: number; slug: string; label: string; color: string; text_color: string }[];
}

interface Props {
	services: AdminServiceRow[];
}

export function AdminServicesTable({ services }: Props) {
	const [rows, setRows] = React.useState(services);

	const toggle = React.useCallback(async (id: number, next: boolean) => {
		setRows((prev) =>
			prev.map((r) => (r.id === id ? { ...r, is_active: next } : r)),
		);
		try {
			const res = await fetch("/api/admin/services", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, is_active: next }),
			});
			if (!res.ok) throw new Error("update failed");
		} catch {
			setRows((prev) =>
				prev.map((r) => (r.id === id ? { ...r, is_active: !next } : r)),
			);
		}
	}, []);

	const columns = React.useMemo<ColumnDef<AdminServiceRow>[]>(
		() => [
			{ accessorKey: "slug", header: "Slug", cell: ({ row }) => <span className="font-mono text-xs">{row.original.slug}</span> },
			{ accessorKey: "name", header: "Name" },
			{ accessorKey: "kind", header: "Kind", cell: ({ row }) => <span className="text-xs uppercase">{row.original.kind}</span> },
			{ accessorKey: "status", header: "Status" },
			{
				id: "badges",
				header: "Badges",
				cell: ({ row }) => (
					<div className="flex flex-wrap gap-1">
						{row.original.badges.map((b) => (
							<Badge
								key={b.id}
								variant="outline"
								style={{ borderColor: b.color, color: b.color }}
								className="text-[10px]"
							>
								{b.label}
							</Badge>
						))}
					</div>
				),
			},
			{
				accessorKey: "env_source",
				header: "Env Source",
				cell: ({ row }) => (
					<span className="font-mono text-xs text-muted-foreground truncate max-w-[200px] block">
						{row.original.env_source ?? "—"}
					</span>
				),
			},
			{
				accessorKey: "is_active",
				header: "Active",
				cell: ({ row }) => (
					<Switch
						checked={row.original.is_active}
						onCheckedChange={(v) => toggle(row.original.id, v)}
						aria-label={`Toggle ${row.original.name}`}
					/>
				),
			},
		],
		[toggle],
	);

	if (rows.length === 0) {
		return <EmptyState title="No services" description="No services registered yet." />;
	}

	return <DataTable columns={columns} data={rows} />;
}
