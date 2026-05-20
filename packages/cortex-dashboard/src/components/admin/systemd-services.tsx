"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { IconButton } from "@/components/ui/icon-button";
import { Play, Square, RefreshCw, FileText } from "lucide-react";

interface SystemdService { name: string; load: string; active: string; sub: string; enabled: string; description: string }
type SystemdAction = "start" | "stop" | "restart";

function StatePill({ active, sub }: { active: string; sub: string }) {
  const cls = active === "active" ? "bg-emerald-500/10 text-emerald-400" : active === "failed" ? "bg-red-500/10 text-red-400" : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{active}/{sub}</span>;
}

export function SystemdServices() {
  const [services, setServices] = useState<SystemdService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");

  async function fetchServices() {
    try { const res = await fetch("/api/systemd", { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`); setServices(data.services ?? []); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to fetch systemd services"); }
    finally { setLoading(false); }
  }
  useEffect(() => { let cancelled = false; (async () => { if (!cancelled) await fetchServices(); })(); return () => { cancelled = true; }; }, []);

  async function runAction(name: string, action: SystemdAction) {
    setActionLoading(`${name}:${action}`); setError(null);
    try { const res = await fetch("/api/systemd/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, action }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`); await fetchServices(); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setActionLoading(null); }
  }

  const columns = useMemo<ColumnDef<SystemdService>[]>(() => [
    { accessorKey: "name", header: "Service", cell: ({ row }) => <span className="font-mono text-xs">{row.original.name}</span> },
    { id: "status", header: "Status", accessorFn: (row) => `${row.active} ${row.sub}`, cell: ({ row }) => <StatePill active={row.original.active} sub={row.original.sub} /> },
    { id: "enabled", header: "Enabled", accessorFn: (row) => `${row.enabled} ${row.load}`, cell: ({ row }) => <span className="text-xs">{row.original.enabled}/{row.original.load}</span> },
    { accessorKey: "description", header: "Description", cell: ({ row }) => <span className="block max-w-[400px] truncate text-xs text-muted-foreground">{row.original.description}</span> },
    { id: "actions", header: "", cell: ({ row }) => { const running = row.original.active === "active"; const primary = running ? "stop" : "start"; return <div className="flex justify-end gap-1"><IconButton tooltip={running ? "Stop" : "Start"} variant={running ? "danger" : "primary"} loading={actionLoading === `${row.original.name}:${primary}`} disabled={actionLoading !== null && actionLoading !== `${row.original.name}:${primary}`} onClick={() => runAction(row.original.name, primary)}>{running ? <Square className="size-3" /> : <Play className="size-3" />}</IconButton><IconButton tooltip="Restart" variant="ghost" loading={actionLoading === `${row.original.name}:restart`} disabled={actionLoading !== null && actionLoading !== `${row.original.name}:restart`} onClick={() => runAction(row.original.name, "restart")}><RefreshCw className="size-3" /></IconButton><IconButton tooltip="Logs" variant="ghost" onClick={() => window.open(`/api/systemd/logs?unit=${encodeURIComponent(row.original.name)}`, "_blank", "noopener,noreferrer")}><FileText className="size-3" /></IconButton></div>; } },
  ], [actionLoading]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading systemd services…</div>;
  return <div className="space-y-3">{error && <p className="text-sm text-destructive" role="alert">{error}</p>}<DataTable columns={columns} data={services} searchPlaceholder="Search services…" globalFilter={globalFilter} onGlobalFilterChange={setGlobalFilter} noPagination /></div>;
}
