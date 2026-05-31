"use client";

import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/sys-pilot/ConfirmDialog";
import type { AlertRule } from "@/lib/types";

// TODO: rewire to real API
export default function AdminAlertsPage() {
  const data: AlertRule[] = [];
  const isLoading = false;

  const columns: Column<AlertRule>[] = [
    { key: "name", header: "Rule", sort: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "service", header: "Service ID", sort: (r) => r.service_id, cell: (r) => <code className="text-xs text-muted-foreground">#{r.service_id}</code> },
    { key: "condition", header: "Condition", sort: (r) => r.condition, cell: (r) => <Badge variant="outline" className="text-[10px]">{r.condition}</Badge> },
    { key: "threshold", header: "Threshold", cell: (r) => <span className="tabular-nums text-xs">{r.threshold_ms ? `${r.threshold_ms}ms` : "—"}</span> },
    { key: "enabled", header: "Enabled", cell: (r) => <Badge variant={r.enabled ? "default" : "secondary"} className="text-[10px]">{r.enabled ? "on" : "off"}</Badge> },
    { key: "actions", header: "", className: "text-right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => toast.info(`Edit ${r.name}`)}><Pencil className="size-3.5" /></Button>
        <ConfirmDialog
          trigger={<Button size="sm" variant="ghost"><Trash2 className="size-3.5 text-destructive" /></Button>}
          title={`Delete rule "${r.name}"?`}
          destructive
          confirmLabel="Delete"
          onConfirm={() => toast.success(`Deleted ${r.name}`)}
        />
      </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alert Rules (Admin)"
        description={`${data.length} rules · ${data.filter((r) => r.enabled).length} enabled`}
        actions={<Button size="sm" onClick={() => toast.info("New rule (mock)")}><Plus className="size-4 mr-1" />New rule</Button>}
      />
      <DataTable rows={data} columns={columns} loading={isLoading} initialSort="name"
        filterFn={(r, q) => r.name.toLowerCase().includes(q)} />
    </div>
  );
}
