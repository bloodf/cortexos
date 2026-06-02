"use client";

import { Play, Square, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/sys-pilot/ConfirmDialog";
import type { SystemdUnit } from "@/lib/types";

async function fetchSystemdUnits(): Promise<SystemdUnit[]> {
  const res = await fetch("/api/systemd");
  if (!res.ok) throw new Error("Failed to load systemd units");
  const json = (await res.json()) as {
    services?: { name: string; load: string; active: string; sub: string; description: string }[];
  };
  return (json.services ?? []).map((s) => ({
    name: s.name,
    description: s.description,
    load: s.load,
    active: s.active as SystemdUnit["active"],
    sub: s.sub,
    enabled: s.sub === "running",
  }));
}

export default function AdminSystemdPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["systemd"], queryFn: fetchSystemdUnits });

  async function runAction(name: string, action: "start" | "stop" | "restart") {
    try {
      const res = await fetch("/api/systemd/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, name }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || `Failed to ${action} ${name}`);
      toast.success(`${action[0].toUpperCase()}${action.slice(1)}ed ${name}`);
      queryClient.invalidateQueries({ queryKey: ["systemd"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to ${action} ${name}`);
    }
  }

  const columns: Column<SystemdUnit>[] = [
    { key: "name", header: "Unit", sort: (r) => r.name, cell: (r) => <code className="text-xs font-medium">{r.name}</code> },
    { key: "description", header: "Description", cell: (r) => <span className="text-muted-foreground">{r.description}</span> },
    { key: "load", header: "Load", sort: (r) => r.load, cell: (r) => <Badge variant="outline" className="text-[10px]">{r.load}</Badge> },
    { key: "active", header: "Active", sort: (r) => r.active, cell: (r) => (
      <Badge variant={r.active === "active" ? "default" : r.active === "failed" ? "destructive" : "secondary"} className="text-[10px]">{r.active}</Badge>
    ) },
    { key: "sub", header: "Sub", cell: (r) => <span className="text-xs text-muted-foreground">{r.sub}</span> },
    { key: "enabled", header: "Enabled", cell: (r) => <Badge variant={r.enabled ? "default" : "outline"} className="text-[10px]">{r.enabled ? "yes" : "no"}</Badge> },
    { key: "actions", header: "", className: "text-right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" title="Start" onClick={() => runAction(r.name, "start")}><Play className="size-3.5" /></Button>
        <ConfirmDialog
          trigger={<Button size="sm" variant="ghost" title="Stop"><Square className="size-3.5" /></Button>}
          title={`Stop ${r.name}?`}
          destructive
          confirmLabel="Stop"
          onConfirm={() => runAction(r.name, "stop")}
        />
        <Button size="sm" variant="ghost" title="Restart" onClick={() => runAction(r.name, "restart")}><RotateCcw className="size-3.5" /></Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Systemd Units (Admin)"
        description={`${data.length} units · ${data.filter((u) => u.active === "active").length} active · ${data.filter((u) => u.active === "failed").length} failed`}
      />
      <DataTable rows={data} columns={columns} loading={isLoading} initialSort="name"
        filterFn={(r, q) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)} />
    </div>
  );
}
