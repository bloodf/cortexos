"use client";
/**
 * Client-side hash-chain audit DataTable. Receives a page of server-fetched
 * rows (server-side paginated by the parent page) and renders them with the
 * shared DataTable primitive: sortable columns, client filter, token-based
 * chain-head / Rekor cells, and an EmptyState fallback.
 */
import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ScrollTextIcon } from "lucide-react";

export interface AuditTableRow {
	id: string;
	occurred_at: string;
	event_id: string;
	event_type: string;
	source: string;
	subject: string | null;
	actor: string | null;
	chain_hash: string;
	rekor_log_index: string | null;
}

export function AuditLogTable({ rows }: { rows: AuditTableRow[] }) {
	const columns = React.useMemo<ColumnDef<AuditTableRow>[]>(
		() => [
			{
				accessorKey: "occurred_at",
				header: "Occurred",
				cell: ({ row }) => (
					<span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
						{new Date(row.original.occurred_at).toISOString()}
					</span>
				),
			},
			{
				accessorKey: "event_type",
				header: "Type",
				cell: ({ row }) => (
					<span className="font-mono text-xs text-foreground">{row.original.event_type}</span>
				),
			},
			{
				accessorKey: "source",
				header: "Source",
				cell: ({ row }) => <span className="text-xs">{row.original.source}</span>,
			},
			{
				accessorKey: "subject",
				header: "Subject",
				cell: ({ row }) => (
					<span className="font-mono text-xs">{row.original.subject ?? "—"}</span>
				),
			},
			{
				accessorKey: "actor",
				header: "Actor",
				cell: ({ row }) => <span className="text-xs">{row.original.actor ?? "—"}</span>,
			},
			{
				accessorKey: "chain_hash",
				header: "Chain head",
				enableSorting: false,
				cell: ({ row }) => (
					<span className="font-mono text-xs text-muted-foreground" title={row.original.chain_hash}>
						{row.original.chain_hash.slice(0, 12)}…
					</span>
				),
			},
			{
				accessorKey: "rekor_log_index",
				header: "Rekor",
				cell: ({ row }) =>
					row.original.rekor_log_index ? (
						<Badge variant="secondary" className="font-mono text-[10px]">
							{row.original.rekor_log_index}
						</Badge>
					) : (
						<span className="text-xs text-muted-foreground">pending</span>
					),
			},
		],
		[],
	);

	return (
		<DataTable
			columns={columns}
			data={rows}
			enableFilter
			filterPlaceholder="Filter audit rows..."
			emptyState={
				<EmptyState
					icon={<ScrollTextIcon />}
					title="No audit rows"
					description="Run an audited helper action to populate the log."
				/>
			}
		/>
	);
}
