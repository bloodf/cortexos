"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AuditEntry } from "@/lib/types";

export default function AdminAuditPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["audit"], queryFn: api.audit, refetchInterval: 10000 });

  const columns: Column<AuditEntry>[] = [
    { key: "created_at", header: "Time", sort: (r) => r.created_at, cell: (r) => <span className="text-xs text-muted-foreground tabular-nums">{new Date(r.created_at).toLocaleString()}</span> },
    { key: "actor", header: "Actor", sort: (r) => r.actor, cell: (r) => <span className="font-medium">{r.actor}</span> },
    { key: "tool", header: "Tool", sort: (r) => r.tool, cell: (r) => <code className="text-xs">{r.tool}</code> },
    { key: "class", header: "Class", sort: (r) => r.tool_class, cell: (r) => <Badge variant="outline" className="text-[10px]">{r.tool_class}</Badge> },
    { key: "decision", header: "Decision", sort: (r) => r.decision, cell: (r) => (
      <Badge variant={r.decision === "allow" ? "default" : "destructive"} className="text-[10px]">{r.decision}</Badge>
    ) },
    { key: "reason", header: "Reason", cell: (r) => <span className="text-xs text-muted-foreground">{r.decision_reason}</span> },
    { key: "hash", header: "Args hash", cell: (r) => <code className="text-[10px] text-muted-foreground">{r.args_hash.slice(0, 10)}…</code> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Chain (Admin)"
        description={`${data.length} entries · tamper-evident`}
        actions={<Button size="sm" variant="outline" onClick={() => {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `audit-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success(`Exported ${data.length} entries`);
        }}><Download className="size-4 mr-1" />Export</Button>}
      />
      <DataTable rows={data} columns={columns} loading={isLoading} initialSort="created_at"
        filterFn={(r, q) => r.actor.toLowerCase().includes(q) || r.tool.includes(q)} />
    </div>
  );
}
