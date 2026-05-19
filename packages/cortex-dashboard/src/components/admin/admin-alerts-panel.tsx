"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";

interface AlertRow {
	id: number;
	kind: string;
	severity: "info" | "warn" | "error" | "critical";
	title: string;
	body: string | null;
	source: string | null;
	acknowledged_at: string | null;
	created_at: string;
}

interface RuleRow {
	id: number;
	service_id: number;
	name: string;
	condition: string;
	threshold_ms: number | null;
	enabled: boolean;
}

interface Props {
	initialAlerts: AlertRow[];
	initialRules: RuleRow[];
}

const SEVERITY_COLORS: Record<AlertRow["severity"], string> = {
	info: "bg-sky-500/10 text-sky-400 border-sky-500/20",
	warn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
	error: "bg-orange-500/10 text-orange-400 border-orange-500/20",
	critical: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function AdminAlertsPanel({ initialAlerts, initialRules }: Props) {
	const [alerts, setAlerts] = React.useState(initialAlerts);
	const [rules, setRules] = React.useState(initialRules);

	async function ack(id: number) {
		const res = await fetch(`/api/alerts/operational?id=${id}`, { method: "PATCH" });
		if (!res.ok) return;
		setAlerts((prev) =>
			prev.map((a) =>
				a.id === id ? { ...a, acknowledged_at: new Date().toISOString() } : a,
			),
		);
	}

	async function toggleRule(id: number, enabled: boolean) {
		setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
		const res = await fetch("/api/alerts", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id, enabled }),
		});
		if (!res.ok) {
			setRules((prev) =>
				prev.map((r) => (r.id === id ? { ...r, enabled: !enabled } : r)),
			);
		}
	}

	const alertColumns = React.useMemo<ColumnDef<AlertRow>[]>(
		() => [
			{
				accessorKey: "created_at",
				header: "Time",
				cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
			},
			{
				accessorKey: "severity",
				header: "Severity",
				cell: ({ row }) => (
					<Badge
						variant="outline"
						className={`text-[10px] ${SEVERITY_COLORS[row.original.severity]}`}
					>
						{row.original.severity}
					</Badge>
				),
			},
			{ accessorKey: "kind", header: "Kind" },
			{ accessorKey: "title", header: "Title" },
			{
				accessorKey: "source",
				header: "Source",
				cell: ({ row }) => row.original.source ?? "—",
			},
			{
				accessorKey: "acknowledged_at",
				header: "Ack",
				cell: ({ row }) =>
					row.original.acknowledged_at ? (
						<span className="text-xs text-muted-foreground">acked</span>
					) : (
						<Button size="sm" variant="ghost" onClick={() => ack(row.original.id)}>
							Acknowledge
						</Button>
					),
			},
		],
		[],
	);

	const ruleColumns = React.useMemo<ColumnDef<RuleRow>[]>(
		() => [
			{ accessorKey: "name", header: "Rule" },
			{ accessorKey: "service_id", header: "Service ID" },
			{ accessorKey: "condition", header: "Condition" },
			{
				accessorKey: "threshold_ms",
				header: "Threshold (ms)",
				cell: ({ row }) => row.original.threshold_ms ?? "—",
			},
			{
				accessorKey: "enabled",
				header: "Enabled",
				cell: ({ row }) => (
					<Switch
						checked={row.original.enabled}
						onCheckedChange={(v) => toggleRule(row.original.id, v)}
						aria-label={`Toggle ${row.original.name}`}
					/>
				),
			},
		],
		[],
	);

	return (
		<div className="space-y-6">
			<section>
				<h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
					Operational alerts
				</h2>
				{alerts.length === 0 ? (
					<EmptyState title="No alerts" description="No operational alerts firing." />
				) : (
					<DataTable columns={alertColumns} data={alerts} />
				)}
			</section>
			<section>
				<h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
					Alert rules
				</h2>
				{rules.length === 0 ? (
					<EmptyState title="No rules" description="No alert rules configured." />
				) : (
					<DataTable columns={ruleColumns} data={rules} />
				)}
			</section>
		</div>
	);
}
