import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/mocks/api";
import type { Badge as BadgeType } from "@/mocks/types";

export function AdminBadgesPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["badges"], queryFn: api.badges });

  const columns: Column<BadgeType>[] = [
    { key: "preview", header: "Preview", cell: (r) => (
      <Badge style={{ background: r.color, color: r.text_color }} className="text-[10px]">{r.label}</Badge>
    ) },
    { key: "slug", header: "Slug", sort: (r) => r.slug, cell: (r) => <code className="text-xs">{r.slug}</code> },
    { key: "label", header: "Label", sort: (r) => r.label, cell: (r) => r.label },
    { key: "color", header: "Color", cell: (r) => (
      <div className="flex items-center gap-2">
        <span className="size-4 rounded border" style={{ background: r.color }} />
        <code className="text-xs text-muted-foreground">{r.color}</code>
      </div>
    ) },
    { key: "actions", header: "", className: "text-right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => toast.info(`Edit ${r.label} (mock)`)}><Pencil className="size-3.5" /></Button>
        <ConfirmDialog
          trigger={<Button size="sm" variant="ghost"><Trash2 className="size-3.5 text-destructive" /></Button>}
          title={`Delete badge "${r.label}"?`}
          destructive
          confirmLabel="Delete"
          onConfirm={() => toast.success(`Deleted ${r.label}`)}
        />
      </div>
    ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manage Badges"
        description={`${data.length} badges`}
        actions={<Button size="sm" onClick={() => toast.info("New badge (mock)")}><Plus className="size-4 mr-1" />New badge</Button>}
      />
      <DataTable rows={data} columns={columns} loading={isLoading} initialSort="slug"
        filterFn={(r, q) => r.slug.includes(q) || r.label.toLowerCase().includes(q)} />
    </div>
  );
}
