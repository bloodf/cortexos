"use client";

import { Play, Square, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/sys-pilot/ConfirmDialog";

interface IncusInstanceRow {
  name: string;
  status: string;
  type: string;
  ipv4: string | null;
  ipv6: string | null;
  architecture: string;
  created: string;
  profiles: string[];
  snapshotsCount: number;
}

async function fetchInstances(): Promise<IncusInstanceRow[]> {
  const res = await fetch("/api/incus");
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Failed to load instances");
  return (json.data ?? []) as IncusInstanceRow[];
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const s = status.toLowerCase();
  if (s === "running") return "default";
  if (s === "stopped") return "destructive";
  return "secondary";
}

export default function AdminIncusPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["incus-instances"], queryFn: fetchInstances, refetchInterval: 5000 });

  async function runAction(action: "start" | "stop" | "restart" | "delete", name: string) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (action === "delete") headers["x-incus-delete-confirm"] = "true";
      const res = await fetch("/api/incus/actions", {
        method: "POST",
        headers,
        body: JSON.stringify({ action, name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed to ${action} ${name}`);
      toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)}${action.endsWith("e") ? "d" : "ed"} ${name}`);
      qc.invalidateQueries({ queryKey: ["incus-instances"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to ${action} ${name}`);
    }
  }

  const columns: Column<IncusInstanceRow>[] = [
    { key: "name", header: "Instance", sort: (r) => r.name, cell: (r) => (
      <div>
        <div className="font-medium">{r.name}</div>
        <code className="text-[10px] text-muted-foreground">{r.ipv4 ?? r.ipv6 ?? "—"}</code>
      </div>
    ) },
    { key: "type", header: "Type", sort: (r) => r.type, cell: (r) => <Badge variant="outline" className="text-[10px]">{r.type}</Badge> },
    { key: "architecture", header: "Arch", sort: (r) => r.architecture, cell: (r) => <code className="text-xs">{r.architecture}</code> },
    { key: "profiles", header: "Profiles", cell: (r) => <span className="text-xs text-muted-foreground">{r.profiles.length ? r.profiles.join(", ") : "—"}</span> },
    { key: "snapshotsCount", header: "Snapshots", sort: (r) => r.snapshotsCount, cell: (r) => <span className="tabular-nums">{r.snapshotsCount}</span> },
    { key: "status", header: "Status", sort: (r) => r.status, cell: (r) => <Badge variant={statusVariant(r.status)} className="text-[10px]">{r.status}</Badge> },
    { key: "actions", header: "", className: "text-right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => runAction("start", r.name)}><Play className="size-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={() => runAction("stop", r.name)}><Square className="size-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={() => runAction("restart", r.name)}><RotateCcw className="size-3.5" /></Button>
        <ConfirmDialog
          trigger={<Button size="sm" variant="ghost"><Trash2 className="size-3.5 text-destructive" /></Button>}
          title={`Delete instance ${r.name}?`}
          description="This will destroy the instance and its storage."
          destructive
          confirmLabel="Delete"
          requireText={r.name}
          onConfirm={() => runAction("delete", r.name)}
        />
      </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Incus (Admin)"
        description={`${data.length} instances · ${data.filter((i) => i.status.toLowerCase() === "running").length} running`}
      />
      <DataTable rows={data} columns={columns} loading={isLoading} initialSort="name"
        filterFn={(r, q) => r.name.toLowerCase().includes(q) || r.architecture.toLowerCase().includes(q)} />
    </div>
  );
}
