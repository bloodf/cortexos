"use client";

import { Play, Square, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/sys-pilot/ConfirmDialog";
import { api } from "@/lib/api";
import type { DockerContainer } from "@/lib/types";

export default function AdminDockerPage() {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["docker", "containers"],
    queryFn: api.docker.containers,
    refetchInterval: 5000,
  });

  async function runAction(action: "start" | "stop" | "restart", name: string) {
    try {
      const res = await fetch("/api/docker/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Failed to ${action} ${name}`);
      toast.success(`${action[0].toUpperCase()}${action.slice(1)}ed ${name}`);
      queryClient.invalidateQueries({ queryKey: ["docker", "containers"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to ${action} ${name}`);
    }
  }

  const columns: Column<DockerContainer>[] = [
    { key: "name", header: "Container", sort: (r) => r.name, cell: (r) => (
      <div>
        <div className="font-medium">{r.name}</div>
        <code className="text-[10px] text-muted-foreground">{r.id.slice(0, 12)}</code>
      </div>
    ) },
    { key: "image", header: "Image", sort: (r) => r.image, cell: (r) => <code className="text-xs">{r.image}</code> },
    { key: "state", header: "State", sort: (r) => r.state, cell: (r) => (
      <Badge variant={r.state === "running" ? "default" : r.state === "exited" ? "destructive" : "secondary"} className="text-[10px]">{r.state}</Badge>
    ) },
    { key: "ports", header: "Ports", cell: (r) => <span className="text-xs font-mono text-muted-foreground">{r.ports || "—"}</span> },
    { key: "created", header: "Created", sort: (r) => r.created, cell: (r) => <span className="text-xs text-muted-foreground">{r.created}</span> },
    { key: "actions", header: "", className: "text-right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => runAction("start", r.name)}><Play className="size-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={() => runAction("stop", r.name)}><Square className="size-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={() => runAction("restart", r.name)}><RotateCcw className="size-3.5" /></Button>
        <ConfirmDialog
          trigger={<Button size="sm" variant="ghost"><Trash2 className="size-3.5 text-destructive" /></Button>}
          title={`Remove container ${r.name}?`}
          destructive
          confirmLabel="Remove"
          requireText={r.name}
          onConfirm={() => toast.error("Container removal is not available")}
        />
      </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Docker (Admin)"
        description={`${data.length} containers · ${data.filter((c) => c.state === "running").length} running`}
      />
      <DataTable rows={data} columns={columns} loading={isLoading} initialSort="name"
        filterFn={(r, q) => r.name.toLowerCase().includes(q) || r.image.toLowerCase().includes(q)} />
    </div>
  );
}
