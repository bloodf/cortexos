"use client";

import * as React from "react";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

interface AuditRow {
	id: number;
	ts: string;
	actor_user_id: number | null;
	role: string | null;
	tool: string | null;
	tool_class: "safe" | "privileged" | "destructive";
	decision: "allow" | "deny" | "prompt";
	result: "ok" | "err" | "timeout" | "denied";
	latency_ms: number | null;
	args_hash: string;
	approval_id: string | null;
	decision_reason: string | null;
	before_state_hash: string | null;
	after_state_hash: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AuditLogTable() {
	const [filters, setFilters] = React.useState({
		tool: "",
		tool_class: "",
		decision: "",
		result: "",
	});
	const [expanded, setExpanded] = React.useState<number | null>(null);

	const qs = React.useMemo(() => {
		const p = new URLSearchParams();
		Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
		return p.toString();
	}, [filters]);

	const { data } = useSWR<{ rows: AuditRow[] }>(`/api/audit?${qs}`, fetcher, { refreshInterval: 10_000 });
	const rows = data?.rows ?? [];

	const columns = React.useMemo<ColumnDef<AuditRow>[]>(
		() => [
			{ accessorKey: "ts", header: "Time", cell: ({ row }) => new Date(row.original.ts).toLocaleString() },
			{ accessorKey: "actor_user_id", header: "Actor" },
			{ accessorKey: "role", header: "Role", cell: ({ row }) => row.original.role ?? "—" },
			{ accessorKey: "tool", header: "Tool" },
			{ accessorKey: "tool_class", header: "Class" },
			{ accessorKey: "decision", header: "Decision" },
			{ accessorKey: "result", header: "Result" },
			{ accessorKey: "latency_ms", header: "ms", cell: ({ row }) => row.original.latency_ms ?? "—" },
			{
				accessorKey: "args_hash",
				header: "Args",
				cell: ({ row }) => <span className="font-mono text-xs">{row.original.args_hash.slice(0, 8)}</span>,
			},
			{
				accessorKey: "approval_id",
				header: "Approval",
				cell: ({ row }) => (
					<span className="font-mono text-xs">{(row.original.approval_id ?? "").slice(0, 8) || "—"}</span>
				),
			},
		],
		[],
	);

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
				<Input
					placeholder="Tool"
					value={filters.tool}
					onChange={(e) => setFilters((p) => ({ ...p, tool: e.target.value }))}
				/>
				<select
					className="h-9 rounded-md border border-border bg-background px-2 text-sm"
					value={filters.tool_class}
					onChange={(e) => setFilters((p) => ({ ...p, tool_class: e.target.value }))}
				>
					<option value="">All classes</option>
					<option value="safe">safe</option>
					<option value="privileged">privileged</option>
					<option value="destructive">destructive</option>
				</select>
				<select
					className="h-9 rounded-md border border-border bg-background px-2 text-sm"
					value={filters.decision}
					onChange={(e) => setFilters((p) => ({ ...p, decision: e.target.value }))}
				>
					<option value="">All decisions</option>
					<option value="allow">allow</option>
					<option value="deny">deny</option>
					<option value="prompt">prompt</option>
				</select>
				<select
					className="h-9 rounded-md border border-border bg-background px-2 text-sm"
					value={filters.result}
					onChange={(e) => setFilters((p) => ({ ...p, result: e.target.value }))}
				>
					<option value="">All results</option>
					<option value="ok">ok</option>
					<option value="err">err</option>
					<option value="timeout">timeout</option>
					<option value="denied">denied</option>
				</select>
			</div>

			{rows.length === 0 ? (
				<EmptyState title="No audit rows" description="No events match the filters." />
			) : (
				<>
					<DataTable columns={columns} data={rows} />
					{expanded !== null && (
						<div className="rounded-md border border-border bg-muted/30 p-3 text-xs font-mono">
							<pre>{JSON.stringify(rows.find((r) => r.id === expanded), null, 2)}</pre>
						</div>
					)}
					<div className="flex gap-2">
						{rows.slice(0, 5).map((r) => (
							<button
								key={r.id}
								type="button"
								onClick={() => setExpanded(r.id === expanded ? null : r.id)}
								className="text-xs text-muted-foreground hover:text-foreground"
							>
								#{r.id} {expanded === r.id ? "▼" : "▶"}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	);
}
