"use client";

import * as React from "react";
import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { IconButton } from "@/components/ui/icon-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Container { ID: string; Names: string; Image: string; State: string; Status: string; Ports: string }
interface Image { ID: string; Repository: string; Tag: string; Size: string; CreatedSince: string }
interface Volume { Name: string; Driver: string; Mountpoint: string }
interface DockerResult<T> { data: T[]; error?: string }
interface DockerData { containers: DockerResult<Container>; volumes: DockerResult<Volume>; images: DockerResult<Image> }
type PruneTarget = "containers" | "images" | "volumes" | "networks";
type DockerTab = "containers" | "images" | "volumes" | "networks";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AdminDockerPanel() {
	const { data, mutate } = useSWR<DockerData>("/api/docker", fetcher, { refreshInterval: 5_000 });
	const [tab, setTab] = React.useState<DockerTab>("containers");
	const [filter, setFilter] = React.useState("");
	const [pruning, setPruning] = React.useState<PruneTarget | null>(null);
	const [err, setErr] = React.useState<string | null>(null);
	const containers = data?.containers?.data ?? [];
	const images = data?.images?.data ?? [];
	const volumes = data?.volumes?.data ?? [];

	async function prune(target: PruneTarget) {
		setErr(null);
		try { const res = await fetch("/api/docker/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "prune", target }) }); if (!res.ok) { const body = (await res.json().catch(() => ({}))) as { error?: string }; throw new Error(body.error ?? `HTTP ${res.status}`); } await mutate(); }
		catch (e) { setErr(e instanceof Error ? e.message : "Prune failed"); }
		finally { setPruning(null); }
	}

	const containerColumns = React.useMemo<ColumnDef<Container>[]>(() => [
		{ accessorKey: "Names", header: "Name", cell: ({ row }) => <span className="font-mono text-xs">{row.original.Names}</span> },
		{ accessorKey: "Image", header: "Image", cell: ({ row }) => <span className="text-xs">{row.original.Image}</span> },
		{ accessorKey: "Status", header: "State", cell: ({ row }) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.original.State === "running" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>{row.original.Status}</span> },
		{ accessorKey: "Ports", header: "Ports", cell: ({ row }) => <span className="font-mono text-xs">{row.original.Ports || "—"}</span> },
	], []);
	const imageColumns = React.useMemo<ColumnDef<Image>[]>(() => [
		{ accessorKey: "Repository", header: "Repository" },
		{ accessorKey: "Tag", header: "Tag", cell: ({ row }) => <span className="font-mono text-xs">{row.original.Tag}</span> },
		{ accessorKey: "Size", header: "Size", cell: ({ row }) => <span className="font-mono text-xs">{row.original.Size}</span> },
		{ accessorKey: "CreatedSince", header: "Created" },
	], []);
	const volumeColumns = React.useMemo<ColumnDef<Volume>[]>(() => [
		{ accessorKey: "Name", header: "Name", cell: ({ row }) => <span className="font-mono text-xs">{row.original.Name}</span> },
		{ accessorKey: "Driver", header: "Driver" },
		{ accessorKey: "Mountpoint", header: "Mountpoint", cell: ({ row }) => <span className="block max-w-[300px] truncate font-mono text-xs">{row.original.Mountpoint}</span> },
	], []);

	const toolbar = <Tabs value={tab} onValueChange={(value) => { setTab(value as DockerTab); setFilter(""); }}><TabsList variant="line"><TabsTrigger value="containers">Containers ({containers.length})</TabsTrigger><TabsTrigger value="images">Images ({images.length})</TabsTrigger><TabsTrigger value="volumes">Volumes ({volumes.length})</TabsTrigger><TabsTrigger value="networks">Networks</TabsTrigger></TabsList></Tabs>;
	const pruneButton = <IconButton tooltip={`Prune ${tab}`} variant="danger" onClick={() => setPruning(tab as PruneTarget)}><Trash2 className="size-4" /></IconButton>;
	const tableProps = { globalFilter: filter, onGlobalFilterChange: setFilter, toolbar: <div className="flex items-center gap-2">{toolbar}{pruneButton}</div>, noPagination: true };

	return <div className="space-y-4">{err && <p className="text-sm text-destructive" role="alert">{err}</p>}{tab === "images" ? <DataTable columns={imageColumns} data={images} searchPlaceholder="Search images…" {...tableProps} /> : tab === "volumes" ? <DataTable columns={volumeColumns} data={volumes} searchPlaceholder="Search volumes…" {...tableProps} /> : tab === "networks" ? <div><div className="mb-3 flex items-center justify-between">{toolbar}{pruneButton}</div><EmptyState title="Network listing" description="Network listing is not exposed yet; use prune to remove unused networks." /></div> : <DataTable columns={containerColumns} data={containers} searchPlaceholder="Search containers…" {...tableProps} />}{pruning && <Dialog open onOpenChange={() => setPruning(null)}><DialogContent><DialogHeader><DialogTitle>Prune {pruning}?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">This runs <code className="font-mono">docker {pruning} prune -f</code> on the host and is audit-logged. Action is irreversible.</p><div className="flex justify-end gap-2 pt-3"><Button variant="outline" size="sm" onClick={() => setPruning(null)}>Cancel</Button><Button variant="destructive" size="sm" onClick={() => prune(pruning)}>Confirm prune</Button></div></DialogContent></Dialog>}</div>;
}
