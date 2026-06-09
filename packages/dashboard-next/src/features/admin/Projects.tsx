import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/mocks/api";
import type { Project } from "@/mocks/types";

export function AdminProjectsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["projects"], queryFn: api.projects });

  const columns: Column<Project>[] = [
    { key: "name", header: "Project", sort: (r) => r.name, cell: (r) => (
      <div>
        <div className="font-medium">{r.name}</div>
        <code className="text-[10px] text-muted-foreground">{r.slug}</code>
      </div>
    ) },
    { key: "desc", header: "Description", cell: (r) => <span className="text-muted-foreground text-xs">{r.description}</span> },
    { key: "repo", header: "Repo", cell: (r) => (
      <a href={r.repo_url} className="text-xs text-primary inline-flex items-center gap-1 hover:underline" target="_blank" rel="noreferrer">
        {r.repo_url.replace("https://", "")} <ExternalLink className="size-3" />
      </a>
    ) },
    { key: "branch", header: "Branch", cell: (r) => <code className="text-xs">{r.branch}</code> },
    { key: "created_at", header: "Created", sort: (r) => r.created_at, cell: (r) => <span className="text-xs text-muted-foreground">{r.created_at.slice(0, 10)}</span> },
    { key: "actions", header: "", className: "text-right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => toast.info(`Edit ${r.name}`)}><Pencil className="size-3.5" /></Button>
        <ConfirmDialog
          trigger={<Button size="sm" variant="ghost"><Trash2 className="size-3.5 text-destructive" /></Button>}
          title={`Delete project ${r.name}?`}
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
        title="Manage Projects"
        description={`${data.length} projects`}
        actions={<Button size="sm" onClick={() => toast.info("New project (mock)")}><Plus className="size-4 mr-1" />New project</Button>}
      />
      <DataTable rows={data} columns={columns} loading={isLoading} initialSort="name"
        filterFn={(r, q) => r.name.toLowerCase().includes(q) || r.slug.includes(q)} />
    </div>
  );
}
