"use client";

import * as React from "react";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
	description: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type SystemdAction = "start" | "stop" | "restart";

export function AdminSystemdTable() {
	const [filter, setFilter] = React.useState("");
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

	const rows = React.useMemo(() => {
		const all = data?.services ?? [];
		if (!filter.trim()) return all;
		const q = filter.toLowerCase();
		return all.filter(
			(s) =>
				s.name.toLowerCase().includes(q) ||
				s.description.toLowerCase().includes(q),
		);
	}, [data?.services, filter]);

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

	const columns = React.useMemo<ColumnDef<SystemdRow>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Unit",
				cell: ({ row }) => (
					<span className="font-mono text-xs">{row.original.name}</span>
				),
			},
			{
				id: "state",
				header: "State",
				cell: ({ row }) => (
					<span className="text-xs">
						{row.original.active}/{row.original.sub}
					</span>
				),
			},
			{
				accessorKey: "description",
				header: "Description",
				cell: ({ row }) => (
					<span className="text-xs text-muted-foreground truncate block max-w-[400px]">
						{row.original.description}
					</span>
				),
			},
			{
				id: "actions",
				header: "Actions",
				cell: ({ row }) => (
					<div className="flex gap-1">
						<IconAction
							label="Start"
							icon={<Play className="size-3" />}
							loading={running === `${row.original.name}:start`}
							onClick={() => setConfirming({ name: row.original.name, action: "start" })}
						/>
						<IconAction
							label="Stop"
							icon={<Square className="size-3" />}
							loading={running === `${row.original.name}:stop`}
							onClick={() => setConfirming({ name: row.original.name, action: "stop" })}
						/>
						<IconAction
							label="Restart"
							icon={<RefreshCw className="size-3" />}
							loading={running === `${row.original.name}:restart`}
							onClick={() =>
								setConfirming({ name: row.original.name, action: "restart" })
							}
						/>
						<IconAction
							label="Logs"
							icon={<FileText className="size-3" />}
							onClick={() => {
								window.open(
									`/api/systemd/logs?unit=${encodeURIComponent(row.original.name)}`,
									"_blank",
									"noopener,noreferrer",
								);
							}}
						/>
					</div>
				),
			},
		],
		[running],
	);

	return (
		<div className="space-y-3">
			<Input
				placeholder="Filter units…"
				value={filter}
				onChange={(e) => setFilter(e.target.value)}
				className="max-w-sm"
			/>

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
				<DataTable columns={columns} data={rows} />
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
