import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Square, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RowActions } from "@/components/RowActions";
import { api } from "@/mocks/api";
import type { IncusInstance } from "@/mocks/types";

const STATUS_VARIANT: Record<IncusInstance["status"], "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline", validated: "secondary", provisioning: "secondary",
  active: "default", failed: "destructive",
};

export function AdminIncusPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["incus"], queryFn: api.incus });
  const [pendingDelete, setPendingDelete] = useState<IncusInstance | null>(null);

  const columns: Column<IncusInstance>[] = [
    { key: "project", header: "Project", sort: (r) => r.project.name, cell: (r) => (
      <div className="min-w-0">
        <div className="font-medium truncate">{r.project.name}</div>
        <p className="text-[10px] text-muted-foreground truncate">{r.project.description}</p>
      </div>
    ) },
    { key: "instance", header: "Instance", sort: (r) => r.name, cell: (r) => (
      <div>
        <code className="text-xs">{r.name}</code>
        <div className="text-[10px] text-muted-foreground">{r.image}</div>
      </div>
    ) },
    { key: "repo", header: "Repo", cell: (r) => r.project.repo_url ? (
      <a href={r.project.repo_url} className="text-xs text-primary inline-flex items-center gap-1 hover:underline" target="_blank" rel="noreferrer">
        {r.project.repo_url.replace("https://", "")}@{r.project.branch} <ExternalLink className="size-3" />
      </a>
    ) : <span className="text-xs text-muted-foreground">—</span> },
    { key: "type", header: "Type", sort: (r) => r.type, cell: (r) => <Badge variant="outline" className="text-[10px]">{r.type}</Badge> },
    { key: "cpu", header: "CPU", sort: (r) => r.cpu, cell: (r) => <span className="tabular-nums">{r.cpu}</span> },
    { key: "memory", header: "RAM", sort: (r) => r.memory, cell: (r) => <span className="tabular-nums">{r.memory} MiB</span> },
    { key: "status", header: "Status", sort: (r) => r.status, cell: (r) => <Badge variant={STATUS_VARIANT[r.status]} className="text-[10px]">{r.status}</Badge> },
    { key: "actions", header: "", className: "text-right", width: "120px", cell: (r) => (
      <RowActions
        actions={[
          { key: "start", label: "Start", icon: <Play className="size-3.5" />, variant: "outline-success", onSelect: () => toast.success(`Started ${r.name}`) },
          { key: "stop", label: "Stop", icon: <Square className="size-3.5" />, variant: "outline-warning", onSelect: () => toast.success(`Stopped ${r.name}`) },
          { key: "delete", label: "Delete", icon: <Trash2 className="size-3.5" />, variant: "outline-destructive", separatorBefore: true, onSelect: () => setPendingDelete(r) },
        ]}
      />
    ) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects & Incus instances"
        description={`${data.length} projects · ${data.filter((i) => i.status === "active").length} active instances`}
      />
      <DataTable rows={data} columns={columns} loading={isLoading} initialSort="project"
        filterFn={(r, q) => r.name.toLowerCase().includes(q) || r.image.toLowerCase().includes(q) || r.project.name.toLowerCase().includes(q)} />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => { if (!o) setPendingDelete(null); }}
        title={pendingDelete ? `Delete project ${pendingDelete.project.name}?` : ""}
        description="This will destroy the instance, its storage, and unlink the project."
        destructive
        confirmLabel="Delete"
        requireText={pendingDelete?.slug}
        onConfirm={() => {
          if (pendingDelete) toast.success(`Deleted ${pendingDelete.name}`);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
