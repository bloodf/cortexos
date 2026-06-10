import { useQuery } from "@tanstack/react-query";
import { Play, Square, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/mocks/api";
import type { SystemdUnit } from "@/mocks/types";

export function AdminSystemdPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["systemd"], queryFn: api.systemd });

  const columns: Column<SystemdUnit>[] = [
    {
      key: "name",
      header: "Unit",
      sort: (r) => r.name,
      cell: (r) => <code className="text-xs font-medium">{r.name}</code>,
    },
    {
      key: "description",
      header: "Description",
      cell: (r) => <span className="text-muted-foreground">{r.description}</span>,
    },
    {
      key: "load",
      header: "Load",
      sort: (r) => r.load,
      cell: (r) => (
        <Badge variant="outline" className="text-[10px]">
          {r.load}
        </Badge>
      ),
    },
    {
      key: "active",
      header: "Active",
      sort: (r) => r.active,
      cell: (r) => (
        <Badge
          variant={
            r.active === "active" ? "default" : r.active === "failed" ? "destructive" : "secondary"
          }
          className="text-[10px]"
        >
          {r.active}
        </Badge>
      ),
    },
    {
      key: "sub",
      header: "Sub",
      cell: (r) => <span className="text-xs text-muted-foreground">{r.sub}</span>,
    },
    {
      key: "enabled",
      header: "Enabled",
      cell: (r) => (
        <Badge variant={r.enabled ? "default" : "outline"} className="text-[10px]">
          {r.enabled ? "yes" : "no"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            title="Start"
            onClick={() => toast.success(`Started ${r.name}`)}
          >
            <Play className="size-3.5" />
          </Button>
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="ghost" title="Stop">
                <Square className="size-3.5" />
              </Button>
            }
            title={`Stop ${r.name}?`}
            destructive
            confirmLabel="Stop"
            onConfirm={() => toast.success(`Stopped ${r.name}`)}
          />
          <Button
            size="sm"
            variant="ghost"
            title="Restart"
            onClick={() => toast.success(`Restarted ${r.name}`)}
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Systemd Units (Admin)"
        description={`${data.length} units · ${data.filter((u) => u.active === "active").length} active · ${data.filter((u) => u.active === "failed").length} failed`}
      />
      <DataTable
        rows={data}
        columns={columns}
        loading={isLoading}
        initialSort="name"
        filterFn={(r, q) =>
          r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
        }
      />
    </div>
  );
}
