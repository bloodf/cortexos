"use client";

import * as React from "react";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Play, Square, RefreshCw, FileText } from "lucide-react";

interface SystemdRow {
	name: string;
	load: string;
	active: string;
	sub: string;
	enabled: string;
	description: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SystemdAction = "start" | "stop" | "restart";

export function AdminSystemdTable() {
	const [globalFilter, setGlobalFilter] = React.useState("");
	const [confirming, setConfirming] = React.useState<
		{ name: string; action: SystemdAction } | null
	>(null);
	const [running, setRunning] = React.useState<string | null>(null);
	const [err, setErr] = React.useState<string | null>(null);

	const { data, mutate } = useSWR<{ services: SystemdRow[]; error?: string }>(
		"/api/systemd",
		fetcher,
		{ refreshInterval: 10_000 },
	);

	const rows = data?.services ?? [];

	async function runAction(name: string, action: SystemdAction) {
		setRunning(`${name}:${action}`);
		setErr(null);
		try {
			const res = await fetch("/api/systemd/actions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, action }),
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(body.error ?? `HTTP ${res.status}`);
			}
			await mutate();
		} catch (e) {
			setErr(e instanceof Error ? e.message : "Action failed");
		} finally {
			setRunning(null);
			setConfirming(null);
		}
	}

	function StatePill({ active, sub }: { active: string; sub: string }) {
		const cls = active === "active" ? "bg-emerald-500/10 text-emerald-400" : active === "failed" ? "bg-red-500/10 text-red-400" : "bg-muted text-muted-foreground";
		return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{active}/{sub}</span>;
	}

	const columns = React.useMemo<ColumnDef<SystemdRow>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Unit",
				cell: ({ row }) => (
					<span className="font-mono text-xs truncate block max-w-[220px]" title={row.original.name}>{row.original.name}</span>
				),
			},
			{
				accessorKey: "load",
				header: "Load",
				cell: ({ row }) => <span className="text-xs">{row.original.load}</span>,
			},
			{
				id: "state",
				cell: ({ row }) => <StatePill active={row.original.active} sub={row.original.sub} />,
				header: "State",
				accessorFn: (row) => `${row.active} ${row.sub}`,
			},
			{
				accessorKey: "enabled",
				header: "Enabled",
				cell: ({ row }) => <span className="text-xs">{row.original.enabled}</span>,
			},
			{
				accessorKey: "description",
				header: "Description",
				cell: ({ row }) => (
					<span className="text-xs text-muted-foreground truncate block max-w-[300px]" title={row.original.description}>
						{row.original.description}
					</span>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => {
					const runningNow = row.original.active === "active";
					const primary = runningNow ? "stop" : "start";
					return (
						<div className="flex justify-end gap-1">
							<IconButton
								tooltip={runningNow ? "Stop" : "Start"}
								variant={runningNow ? "danger" : "primary"}
								loading={running === `${row.original.name}:${primary}`}
								onClick={() => setConfirming({ name: row.original.name, action: primary })}
							>
								{runningNow ? <Square className="size-3" /> : <Play className="size-3" />}
							</IconButton>
							<IconButton
								tooltip="Restart"
								variant="ghost"
								loading={running === `${row.original.name}:restart`}
								onClick={() => setConfirming({ name: row.original.name, action: "restart" })}
							>
								<RefreshCw className="size-3" />
							</IconButton>
							<IconButton
								tooltip="Logs"
								variant="ghost"
								onClick={() => window.open(`/api/systemd/logs?unit=${encodeURIComponent(row.original.name)}`, "_blank", "noopener,noreferrer")}
							>
								<FileText className="size-3" />
							</IconButton>
						</div>
					);
				},
			},
		],
		[StatePill, running],
	);

	return (
		<div className="space-y-3">
			{err && (
				<p className="text-sm text-destructive" role="alert">
					{err}
				</p>
			)}
			{data?.error && !rows.length && (
				<p className="text-sm text-destructive">{data.error}</p>
			)}

			{rows.length === 0 ? (
				<EmptyState
					title="No systemd units"
					description={data ? "No units match the filter." : "Loading…"}
				/>
			) : (
				<DataTable
					columns={columns}
					data={rows}
					searchPlaceholder="Filter units…"
					globalFilter={globalFilter}
					onGlobalFilterChange={setGlobalFilter}
					noPagination
				/>
			)}

			{confirming && (
				<Dialog open onOpenChange={() => setConfirming(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{confirming.action} {confirming.name}?
							</DialogTitle>
						</DialogHeader>
						<p className="text-sm text-muted-foreground">
							This will run <code className="font-mono">systemctl {confirming.action}</code> on
							the host and is audit-logged.
						</p>
						<div className="flex justify-end gap-2 pt-3">
							<Button variant="outline" size="sm" onClick={() => setConfirming(null)}>
								Cancel
							</Button>
							<Button
								size="sm"
								onClick={() => runAction(confirming.name, confirming.action)}
								disabled={running !== null}
							>
								{running === `${confirming.name}:${confirming.action}`
									? "…"
									: `Confirm ${confirming.action}`}
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}

function IconAction({
	label,
	icon,
	loading,
	onClick,
}: {
	label: string;
	icon: React.ReactNode;
	loading?: boolean;
	onClick: () => void;
}) {
	return (
		<Button
			size="sm"
			variant="ghost"
			aria-label={label}
			disabled={loading}
			onClick={onClick}
			className="h-7 w-7 p-0"
		>
			{loading ? "…" : icon}
		</Button>
	);
}
