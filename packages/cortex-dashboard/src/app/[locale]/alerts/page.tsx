"use client";

import { Bell } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IncidentTimeline } from "@/components/sys-pilot/IncidentTimeline";
import { api } from "@/lib/api";

import { useQuery } from "@tanstack/react-query";
import type { AlertRule, AlertHistory } from "@/lib/types";
import { relativeTime } from "@/lib/sys-pilot/format";
import { cn } from "@/lib/utils";

export default function AlertsPage() {
  const { data: rules = [] } = useQuery({ queryKey: ["alerts", "rules"], queryFn: api.alerts.rules });
  const { data: history = [] } = useQuery({ queryKey: ["alerts", "history"], queryFn: api.alerts.history, refetchInterval: 3000 });

  const ruleCols: Column<AlertRule>[] = [
    { key: "name", header: "Rule", sort: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "cond", header: "Condition", cell: (r) => <code className="text-xs">{r.condition}{r.threshold_ms ? ` · ${r.threshold_ms}ms` : ""}</code> },
    { key: "enabled", header: "Enabled", cell: (r) => <Switch checked={r.enabled} disabled /> },
  ];
  const histCols: Column<AlertHistory>[] = [
    { key: "ts", header: "When", sort: (r) => r.timestamp, cell: (r) => <span className="text-xs text-muted-foreground">{relativeTime(r.timestamp)}</span> },
    { key: "rule", header: "Rule", cell: (r) => <span className="font-medium">{r.ruleName}</span> },
    { key: "svc", header: "Service", cell: (r) => r.serviceName },
    { key: "msg", header: "Message", cell: (r) => <span className="text-xs">{r.message}</span> },
    { key: "st", header: "Status", cell: (r) => <Badge variant="outline" className={cn(r.status === "fired" && "border-destructive text-destructive", r.status === "resolved" && "border-[var(--success)] text-[var(--success)]")}>{r.status}</Badge> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader icon={<Bell className="size-5" />} title={"Alerts"} description={`${rules.length} rules · ${history.filter((h) => h.status === "fired").length} firing`} />
      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline" className="mt-4"><Card className="p-5"><IncidentTimeline items={history} /></Card></TabsContent>
        <TabsContent value="history" className="mt-4"><DataTable rows={history} columns={histCols} initialSort="ts" filterFn={(r, q) => r.ruleName.toLowerCase().includes(q) || r.serviceName.toLowerCase().includes(q)} /></TabsContent>
        <TabsContent value="rules" className="mt-4"><DataTable rows={rules} columns={ruleCols} initialSort="name" filterFn={(r, q) => r.name.toLowerCase().includes(q)} /></TabsContent>
      </Tabs>
    </div>
  );
}
