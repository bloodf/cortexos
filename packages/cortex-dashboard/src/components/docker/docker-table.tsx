"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonTable } from "@/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DockerActionButtons } from "./action-buttons";

interface CliContainer { ID: string; Names: string; Image: string; Command: string; CreatedAt: string; Ports: string; State: string; Status: string; Networks: string; Size: string }
interface CliVolume { Name: string; Driver: string; Mountpoint: string; Scope: string; Labels: string }
interface CliImage { ID: string; Repository: string; Tag: string; Size: string; CreatedSince: string }
interface DockerResult<T> { data: T[]; error?: string }
interface DockerData { containers: DockerResult<CliContainer>; volumes: DockerResult<CliVolume>; images: DockerResult<CliImage> }
type DockerTab = "containers" | "images" | "volumes";

export function DockerTable() {
  const [data, setData] = useState<DockerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<DockerTab>("containers");

  async function refreshData() {
    try { const res = await fetch("/api/docker", { cache: "no-store" }); if (!res.ok) throw new Error(`HTTP ${res.status}`); setData(await res.json() as DockerData); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to fetch"); }
    finally { setLoading(false); }
  }

  useEffect(() => { let mounted = true; const run = async () => { if (mounted) await refreshData(); }; run(); const interval = setInterval(run, 5000); return () => { mounted = false; clearInterval(interval); }; }, []);

  const containers = Array.isArray(data?.containers?.data) ? data.containers.data : [];
  const volumes = Array.isArray(data?.volumes?.data) ? data.volumes.data : [];
  const images = Array.isArray(data?.images?.data) ? data.images.data : [];

  const containerColumns = useMemo<ColumnDef<CliContainer>[]>(() => [
    { accessorKey: "Names", header: "Name", cell: ({ row }) => <span className="font-mono text-xs">{row.original.Names}</span> },
    { accessorKey: "Status", header: "Status", cell: ({ row }) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.original.State === "running" ? "bg-emerald-500/10 text-emerald-400" : row.original.State === "paused" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}`}>{row.original.Status}</span> },
    { accessorKey: "Image", header: "Image", cell: ({ row }) => <span className="text-xs">{row.original.Image}</span> },
    { accessorKey: "Ports", header: "Ports", cell: ({ row }) => <span className="font-mono text-xs">{row.original.Ports || "—"}</span> },
    { id: "actions", header: "", cell: ({ row }) => <div className="flex justify-end"><DockerActionButtons name={row.original.Names} onComplete={refreshData} /></div> },
  ], []);
  const volumeColumns = useMemo<ColumnDef<CliVolume>[]>(() => [
    { accessorKey: "Name", header: "Name", cell: ({ row }) => <span className="font-mono text-xs">{row.original.Name}</span> },
    { accessorKey: "Driver", header: "Driver", cell: ({ row }) => <span className="text-xs">{row.original.Driver}</span> },
    { accessorKey: "Mountpoint", header: "Mountpoint", cell: ({ row }) => <span className="block max-w-[300px] truncate font-mono text-xs">{row.original.Mountpoint}</span> },
  ], []);
  const imageColumns = useMemo<ColumnDef<CliImage>[]>(() => [
    { accessorKey: "Repository", header: "Repository", cell: ({ row }) => <span className="text-xs">{row.original.Repository}</span> },
    { accessorKey: "Tag", header: "Tag", cell: ({ row }) => <span className="font-mono text-xs">{row.original.Tag}</span> },
    { accessorKey: "Size", header: "Size", cell: ({ row }) => <span className="font-mono text-xs">{row.original.Size}</span> },
    { accessorKey: "CreatedSince", header: "Created", cell: ({ row }) => <span className="text-xs">{row.original.CreatedSince}</span> },
  ], []);

  if (loading) return <div className="space-y-6 animate-[slide-in_0.4s_ease-out]"><SkeletonTable rows={5} cols={4} /></div>;
  if (error) return <div className="text-sm text-red-400">{error}</div>;

  const toolbar = <Tabs value={tab} onValueChange={(value) => { setTab(value as DockerTab); setFilter(""); }}><TabsList variant="line"><TabsTrigger value="containers">Containers ({containers.length})</TabsTrigger><TabsTrigger value="images">Images ({images.length})</TabsTrigger><TabsTrigger value="volumes">Volumes ({volumes.length})</TabsTrigger></TabsList></Tabs>;
  const tableProps = { globalFilter: filter, onGlobalFilterChange: setFilter, toolbar, noPagination: true };
  if (tab === "images") return <DataTable columns={imageColumns} data={images} searchPlaceholder="Search images…" {...tableProps} />;
  if (tab === "volumes") return <DataTable columns={volumeColumns} data={volumes} searchPlaceholder="Search volumes…" {...tableProps} />;
  return <DataTable columns={containerColumns} data={containers} searchPlaceholder="Search containers…" {...tableProps} />;
}
