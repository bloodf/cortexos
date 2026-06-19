import { useQueryClient } from "@tanstack/react-query";
import { Clock, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useT";
import { relativeTime } from "@/lib/format";
import { api, callSystemdAction, callMintApproval } from "@/lib/api/client";
import { csrfHeaders } from "@/lib/csrf";
import type { SchedulerJob } from "@/lib/api/client";

function formatTime(iso: string): string {
  if (!iso) return "—";
  return relativeTime(iso);
}

/**
 * Mint an approval token then dispatch a systemd action against a unit.
 * Reuses the gated/audited systemd RPC (same path as the Systemd page).
 * "Run now" starts the target `.service`; the toggle enables/disables the
 * `.timer` unit (`SchedulerJob.id` is always the timer unit name).
 */
async function dispatchSystemdAction(
  action: "start" | "enable" | "disable",
  name: string,
): Promise<void> {
  const mint = await callMintApproval({
    data: { action: "systemd.action", payload: { action, name } },
  });
  await callSystemdAction({
    data: { action, name },
    headers: { ...csrfHeaders(), "x-cortex-approval-token": mint.token },
  });
}

export function SchedulerPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const qc = useQueryClient();
  const t = useT();
  const [pending, setPending] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["scheduler"] }).catch(() => {});
  };

  const toggle = async (j: SchedulerJob) => {
    const action = j.enabled ? "disable" : "enable";
    setPending(`toggle-${j.id}`);
    try {
      await dispatchSystemdAction(action, j.id);
      toast.success(j.enabled ? `Disabled ${j.id}` : `Enabled ${j.id}`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update timer");
    } finally {
      setPending(null);
    }
  };

  const runNow = async (j: SchedulerJob) => {
    if (!j.target) {
      toast.error(`No target unit for ${j.id}`);
      return;
    }
    const unit = j.target;
    setPending(`run-${j.id}`);
    try {
      await dispatchSystemdAction("start", unit);
      toast.success(`Triggered ${unit}`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to trigger job");
    } finally {
      setPending(null);
    }
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
      cell: (r) => <span className="text-xs text-muted-foreground">{formatTime(r.lastRun)}</span>,
    },
    {
      key: "nextRun",
      header: "Next run",
      sort: (r) => r.nextRun,
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.enabled ? formatTime(r.nextRun) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sort: (r) => r.status,
      cell: (r) => {
        let statusClass = "border-muted-foreground text-muted-foreground";
        if (r.status === "ok") statusClass = "border-[var(--success)] text-[var(--success)]";
        else if (r.status === "failing") statusClass = "border-destructive text-destructive";
        return (
          <Badge variant="outline" className={statusClass}>
            {r.status}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex items-center gap-2 justify-end">
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending === `run-${r.id}`}
              onClick={() => runNow(r)}
              aria-label={`Run ${r.id} now`}
            >
              {pending === `run-${r.id}` ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
            </Button>
          )}
          {isAdmin && (
            <Switch
              checked={r.enabled}
              disabled={pending === `toggle-${r.id}`}
              onCheckedChange={() => toggle(r)}
              aria-label={`Toggle ${r.id}`}
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
        title={t.nav.scheduler}
        description="Cron jobs and scheduled tasks across systemd timers and Docker."
      />
      <DataTable
        columns={cols}
        initialSort="nextRun"
        server={{ queryKey: ["scheduler"], fetch: api.schedulerList }}
      />
    </div>
  );
}
