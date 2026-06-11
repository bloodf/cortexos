import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { relativeTime } from "@/lib/format";
import { api } from "@/mocks/api";
import type { SchedulerJob } from "@/mocks/types";

function SchedulerPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const qc = useQueryClient();
  useQuery({
    queryKey: ["scheduler"],
    queryFn: api.scheduler,
  });

  const toggle = (id: string) => {
    qc.setQueryData<SchedulerJob[]>(["scheduler"], (p) =>
      p?.map((j) =>
        j.id === id ? { ...j, enabled: !j.enabled, status: !j.enabled ? "ok" : "paused" } : j,
      ),
    );
    toast.success("Job updated");
  };
  const runNow = (j: SchedulerJob) => {
    qc.setQueryData<SchedulerJob[]>(["scheduler"], (p) =>
      p?.map((x) =>
        x.id === j.id ? { ...x, lastRun: new Date().toISOString(), status: "ok" } : x,
      ),
    );
    toast.success(`Triggered ${j.name}`, { description: "Simulated run queued." });
  };

  const cols: Column<SchedulerJob>[] = [
    {
      key: "name",
      header: "Name",
      sort: (r) => r.name,
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    { key: "cron", header: "Schedule", cell: (r) => <code className="text-xs">{r.cron}</code> },
    {
      key: "target",
      header: "Target",
      cell: (r) => (
        <code className="text-xs text-muted-foreground truncate max-w-[280px] inline-block">
          {r.target}
        </code>
      ),
    },
    {
      key: "lastRun",
      header: "Last run",
      sort: (r) => r.lastRun,
      cell: (r) => <span className="text-xs text-muted-foreground">{relativeTime(r.lastRun)}</span>,
    },
    {
      key: "nextRun",
      header: "Next run",
      sort: (r) => r.nextRun,
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.enabled ? relativeTime(r.nextRun) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sort: (r) => r.status,
      cell: (r) => (
        <Badge
          variant="outline"
          className={
            r.status === "ok"
              ? "border-[var(--success)] text-[var(--success)]"
              : r.status === "failing"
                ? "border-destructive text-destructive"
                : "border-muted-foreground text-muted-foreground"
          }
        >
          {r.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex items-center gap-2 justify-end">
          {isAdmin && r.enabled && (
            <Button size="sm" variant="ghost" onClick={() => runNow(r)}>
              <Play className="size-3.5" />
            </Button>
          )}
          {isAdmin && (
            <Switch
              checked={r.enabled}
              onCheckedChange={() => toggle(r.id)}
              aria-label={`Enable ${r.name}`}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Clock className="size-5" />}
        title="Scheduler"
        description="Cron jobs and scheduled tasks across systemd timers and Docker."
        actions={
          isAdmin && (
            <Button size="sm" onClick={() => toast.success("New job form (simulated)")}>
              <Plus className="size-4 mr-1" />
              New job
            </Button>
          )
        }
      />
      <DataTable
        columns={cols}
        initialSort="nextRun"
        server={{ queryKey: ["scheduler"], fetch: api.schedulerList }}
      />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/scheduler")({ component: SchedulerPage });
