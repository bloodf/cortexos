import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IncidentTimeline } from "@/components/IncidentTimeline";
import { TableSkeleton, CardSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api/client";
import { useT } from "@/hooks/useT";
import type { AlertRule, AlertHistory } from "@/mocks/types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AlertsPage() {
  const t = useT();
  const qc = useQueryClient();

  const {
    data: rules = [],
    isLoading: lr,
    isError: er,
  } = useQuery({
    queryKey: ["alerts", "rules"],
    queryFn: api.alerts.rules,
    refetchInterval: 30_000,
  });

  const {
    data: history = [],
    isLoading: lh,
    isError: eh,
  } = useQuery({
    queryKey: ["alerts", "history"],
    queryFn: api.alerts.history,
    refetchInterval: 30_000,
  });

  const firingCount = history.filter((h) => h.status === "fired").length;

  const ruleCols: Column<AlertRule>[] = [
    {
      key: "name",
      header: "Rule",
      sort: (r) => r.name,
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: "cond",
      header: "Condition",
      cell: (r) => (
        <code className="text-xs">
          {r.condition}
          {r.threshold_ms ? ` · ${r.threshold_ms}ms` : ""}
        </code>
      ),
    },
    {
      key: "enabled",
      header: "Enabled",
      cell: (r) => <Switch checked={r.enabled} disabled />,
    },
  ];

  const histCols: Column<AlertHistory>[] = [
    {
      key: "timestamp",
      header: "When",
      sort: (r) => r.timestamp,
      cell: (r) => (
        <span className="text-xs text-muted-foreground">{relativeTime(r.timestamp)}</span>
      ),
    },
    {
      key: "ruleName",
      header: "Rule",
      sort: (r) => r.ruleName,
      cell: (r) => <span className="font-medium">{r.ruleName}</span>,
    },
    {
      key: "svc",
      header: "Service",
      cell: (r) => r.serviceName,
    },
    {
      key: "msg",
      header: "Message",
      cell: (r) => <span className="text-xs">{r.message}</span>,
    },
    {
      key: "status",
      header: "Status",
      sort: (r) => r.status,
      cell: (r) => (
        <Badge
          variant="outline"
          className={cn(
            r.status === "fired" && "border-destructive text-destructive",
            r.status === "resolved" && "border-[var(--success)] text-[var(--success)]",
          )}
        >
          {r.status}
        </Badge>
      ),
    },
  ];

  let timelinePanel: React.ReactNode;
  if (lh) {
    timelinePanel = <CardSkeleton lines={5} />;
  } else if (eh) {
    timelinePanel = (
      <EmptyState
        title="Failed to load alert history"
        description="Could not reach the alerts service."
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["alerts", "history"] })}
          >
            Retry
          </Button>
        }
      />
    );
  } else if (history.length === 0) {
    timelinePanel = (
      <EmptyState
        title="No incidents recorded"
        description="Alert firings will appear here once rules trigger."
      />
    );
  } else {
    timelinePanel = (
      <Card className="p-5">
        <IncidentTimeline items={history} />
      </Card>
    );
  }

  let historyPanel: React.ReactNode;
  if (lh) {
    historyPanel = <TableSkeleton rows={8} cols={5} />;
  } else if (eh) {
    historyPanel = (
      <EmptyState
        title="Failed to load history"
        description="Could not reach the alerts service."
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["alerts", "history"] })}
          >
            Retry
          </Button>
        }
      />
    );
  } else {
    historyPanel = (
      <DataTable
        columns={histCols}
        initialSort="timestamp"
        initialSortDir="desc"
        server={{
          queryKey: ["alerts", "history"],
          fetch: api.alerts.historyList,
          refetchInterval: 30_000,
        }}
      />
    );
  }

  let rulesPanel: React.ReactNode;
  if (lr) {
    rulesPanel = <TableSkeleton rows={5} cols={3} />;
  } else if (er) {
    rulesPanel = (
      <EmptyState
        title="Failed to load rules"
        description="Could not reach the alerts service."
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["alerts", "rules"] })}
          >
            Retry
          </Button>
        }
      />
    );
  } else {
    rulesPanel = (
      <DataTable
        columns={ruleCols}
        initialSort="name"
        server={{ queryKey: ["alerts", "rules"], fetch: api.alerts.rulesList }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Bell className="size-5" />}
        title={t.nav.alerts}
        description={`${rules.length} rules · ${firingCount} firing`}
      />
      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          {timelinePanel}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {historyPanel}
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          {rulesPanel}
        </TabsContent>
      </Tabs>
    </div>
  );
}
