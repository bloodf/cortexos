"use client";

import * as React from "react";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AuditRow { id: number; ts: string; actor_user_id: number | null; role: string | null; tool: string | null; tool_class: "safe" | "privileged" | "destructive"; decision: "allow" | "deny" | "prompt"; result: "ok" | "err" | "timeout" | "denied"; latency_ms: number | null; args_hash: string; approval_id: string | null; decision_reason: string | null; before_state_hash: string | null; after_state_hash: string | null }
const fetcher = (url: string) => fetch(url).then((r) => r.json());
const ALL = "__all";

function Pill({ value, kind }: { value: string; kind: "class" | "result" | "decision" }) {
	const cls = value === "ok" || value === "allow" || value === "safe" ? "bg-emerald-500/10 text-emerald-400" : value === "err" || value === "denied" || value === "deny" || value === "destructive" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400";
	return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{value}</span>;
}

export function AuditLogTable() {
	const [filters, setFilters] = React.useState({ tool: "", tool_class: "", decision: "", result: "" });
	const [expanded, setExpanded] = React.useState<number | null>(null);
	const qs = React.useMemo(() => { const p = new URLSearchParams(); Object.entries(filters).forEach(([k, v]) => v && p.set(k, v)); return p.toString(); }, [filters]);
	const { data } = useSWR<{ rows: AuditRow[] }>(`/api/audit?${qs}`, fetcher, { refreshInterval: 10_000 });
	const rows = data?.rows ?? [];
	const expandedRow = rows.find((row) => row.id === expanded);
	const columns = React.useMemo<ColumnDef<AuditRow>[]>(() => [
		{ accessorKey: "ts", header: "Time", cell: ({ row }) => new Date(row.original.ts).toLocaleString() },
		{ accessorKey: "tool", header: "Tool" },
		{ accessorKey: "tool_class", header: "Class", cell: ({ row }) => <Pill value={row.original.tool_class} kind="class" /> },
		{ accessorKey: "decision", header: "Decision", cell: ({ row }) => <Pill value={row.original.decision} kind="decision" /> },
		{ accessorKey: "result", header: "Result", cell: ({ row }) => <Pill value={row.original.result} kind="result" /> },
		{ accessorKey: "latency_ms", header: "ms", cell: ({ row }) => row.original.latency_ms ?? "—" },
		{ id: "actions", header: "", cell: ({ row }) => <div className="flex justify-end"><IconButton tooltip={expanded === row.original.id ? "Hide details" : "Show details"} variant="ghost" onClick={() => setExpanded(expanded === row.original.id ? null : row.original.id)}>{expanded === row.original.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</IconButton></div> },
	], [expanded]);
	const select = (key: "tool_class" | "decision" | "result", label: string, values: string[]) => <Select value={filters[key] || ALL} onValueChange={(value) => setFilters((p) => ({ ...p, [key]: value === ALL ? "" : value }))}><SelectTrigger className="w-full"><SelectValue placeholder={label} /></SelectTrigger><SelectContent><SelectItem value={ALL}>{label}</SelectItem>{values.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>;
	return <div className="space-y-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Input placeholder="Tool" value={filters.tool} onChange={(e) => setFilters((p) => ({ ...p, tool: e.target.value }))} />{select("tool_class", "All classes", ["safe", "privileged", "destructive"])}{select("decision", "All decisions", ["allow", "deny", "prompt"])}{select("result", "All results", ["ok", "err", "timeout", "denied"])}</div>{rows.length === 0 ? <EmptyState title="No audit rows" description="No events match the filters." /> : <DataTable columns={columns} data={rows} />}{expandedRow && <div className="rounded-md border border-border bg-muted/30 p-3 text-xs font-mono"><pre className="overflow-x-auto">{JSON.stringify(expandedRow, null, 2)}</pre></div>}</div>;
}
