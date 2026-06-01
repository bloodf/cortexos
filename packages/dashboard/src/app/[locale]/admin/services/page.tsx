"use client";

import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { TechIcon } from "@/components/sys-pilot/TechIcon";
import { StatusBadge } from "@/components/sys-pilot/StatusBadge";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/sys-pilot/ConfirmDialog";
import type { Service } from "@/lib/types";

// TODO: rewire to real API
export default function AdminServicesPage() {
  const data: Service[] = [];
  const isLoading = false;

  const columns: Column<Service>[] = [
    {
      key: "name", header: "Service", sort: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <TechIcon slug={r.slug} name={r.name} size={24} />
          <div>
            <div className="font-medium text-foreground">{r.name}</div>
            <div className="text-xs text-muted-foreground">{r.slug}</div>
          </div>
        </div>
      ),
    },
    { key: "category", header: "Category", sort: (r) => r.category, cell: (r) => <span className="text-muted-foreground">{r.category}</span> },
    { key: "kind", header: "Kind", sort: (r) => r.kind, cell: (r) => <Badge variant="outline" className="text-[10px]">{r.kind}</Badge> },
    { key: "type", header: "Health", sort: (r) => r.health_type, cell: (r) => <code className="text-xs">{r.health_type}</code> },
    { key: "status", header: "Status", sort: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { key: "active", header: "Active", cell: (r) => <Badge variant={r.is_active ? "default" : "secondary"} className="text-[10px]">{r.is_active ? "Yes" : "No"}</Badge> },
    {
      key: "actions", header: "", className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => toast.info(`Edit ${r.name} (mock)`)}><Pencil className="size-3.5" /></Button>
          <ConfirmDialog
            trigger={<Button size="sm" variant="ghost"><Trash2 className="size-3.5 text-destructive" /></Button>}
            title={`Delete ${r.name}?`}
            description="This will remove the service from the registry."
            destructive
            confirmLabel="Delete"
            requireText={r.slug}
            onConfirm={() => toast.success(`Deleted ${r.name}`)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manage Services"
        description={`${data.length} services registered`}
        actions={<Button size="sm" onClick={() => toast.info("New service form (mock)")}><Plus className="size-4 mr-1" />Add service</Button>}
      />
      <DataTable
        rows={data}
        columns={columns}
        loading={isLoading}
        initialSort="name"
        filterFn={(r, q) => r.name.toLowerCase().includes(q) || r.slug.includes(q) || r.category.toLowerCase().includes(q)}
      />
    </div>
  );
}
