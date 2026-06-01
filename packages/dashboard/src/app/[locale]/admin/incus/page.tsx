"use client";

import { Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/sys-pilot/ConfirmDialog";
import type { IncusInstance } from "@/lib/types";

const STATUS_VARIANT: Record<IncusInstance["status"], "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline", validated: "secondary", provisioning: "secondary",
  active: "default", failed: "destructive",
};

// TODO: rewire to real API
export default function AdminIncusPage() {
  const data: IncusInstance[] = [];
  const isLoading = false;

  const columns: Column<IncusInstance>[] = [
    { key: "name", header: "Instance", sort: (r) => r.name, cell: (r) => (
      <div>
        <div className="font-medium">{r.name}</div>
        <code className="text-[10px] text-muted-foreground">{r.slug}</code>
      </div>
    ) },
    { key: "type", header: "Type", sort: (r) => r.type, cell: (r) => <Badge variant="outline" className="text-[10px]">{r.type}</Badge> },
    { key: "image", header: "Image", sort: (r) => r.image, cell: (r) => <code className="text-xs">{r.image}</code> },
    { key: "cpu", header: "CPU", sort: (r) => r.cpu, cell: (r) => <span className="tabular-nums">{r.cpu}</span> },
    { key: "memory", header: "RAM", sort: (r) => r.memory, cell: (r) => <span className="tabular-nums">{r.memory} GiB</span> },
    { key: "status", header: "Status", sort: (r) => r.status, cell: (r) => <Badge variant={STATUS_VARIANT[r.status]} className="text-[10px]">{r.status}</Badge> },
    { key: "actions", header: "", className: "text-right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => toast.success(`Started ${r.name}`)}><Play className="size-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={() => toast.success(`Stopped ${r.name}`)}><Square className="size-3.5" /></Button>
        <ConfirmDialog
          trigger={<Button size="sm" variant="ghost"><Trash2 className="size-3.5 text-destructive" /></Button>}
          title={`Delete instance ${r.name}?`}
          description="This will destroy the instance and its storage."
          destructive
          confirmLabel="Delete"
          requireText={r.slug}
          onConfirm={() => toast.success(`Deleted ${r.name}`)}
        />
      </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Incus (Admin)"
        description={`${data.length} instances · ${data.filter((i) => i.status === "active").length} active`}
      />
      <DataTable rows={data} columns={columns} loading={isLoading} initialSort="name"
        filterFn={(r, q) => r.name.toLowerCase().includes(q) || r.image.toLowerCase().includes(q)} />
    </div>
  );
}
