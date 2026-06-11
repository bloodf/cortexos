import { useQuery } from "@tanstack/react-query";
import { Play, Square, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/mocks/api";
import type { DockerContainer } from "@/mocks/types";

export function AdminDockerPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["docker", "containers"],
    queryFn: api.docker.containers,
  });

  const columns: Column<DockerContainer>[] = [
    {
      key: "name",
      header: "Container",
      sort: (r) => r.name,
      cell: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <code className="text-[10px] text-muted-foreground">{r.id.slice(0, 12)}</code>
        </div>
      ),
    },
    {
      key: "image",
      header: "Image",
      sort: (r) => r.image,
      cell: (r) => <code className="text-xs">{r.image}</code>,
    },
    {
      key: "state",
      header: "State",
      sort: (r) => r.state,
      cell: (r) => {
        let variant: "default" | "destructive" | "secondary" = "secondary";
        if (r.state === "running") variant = "default";
        else if (r.state === "exited") variant = "destructive";
        return (
          <Badge variant={variant} className="text-[10px]">
            {r.state}
          </Badge>
        );
      },
    },
    {
      key: "ports",
      header: "Ports",
      cell: (r) => (
        <span className="text-xs font-mono text-muted-foreground">{r.ports || "—"}</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      sort: (r) => r.created,
      cell: (r) => <span className="text-xs text-muted-foreground">{r.created}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => toast.success(`Started ${r.name}`)}>
            <Play className="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => toast.success(`Stopped ${r.name}`)}>
            <Square className="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => toast.success(`Restarted ${r.name}`)}>
            <RotateCcw className="size-3.5" />
          </Button>
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="ghost">
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            }
            title={`Remove container ${r.name}?`}
            destructive
            confirmLabel="Remove"
            requireText={r.name}
            onConfirm={() => toast.success(`Removed ${r.name}`)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Docker (Admin)"
        description={`${data.length} containers · ${data.filter((c) => c.state === "running").length} running`}
      />
      <DataTable
        rows={data}
        columns={columns}
        loading={isLoading}
        initialSort="name"
        filterFn={(r, q) => r.name.toLowerCase().includes(q) || r.image.toLowerCase().includes(q)}
      />
    </div>
  );
}
