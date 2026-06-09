import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { TechIcon } from "@/components/TechIcon";
import { DataTable, type Column } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogStream } from "@/components/LogStream";
import { api } from "@/mocks/api";
import { useT } from "@/hooks/useT";
import { ms, relativeTime } from "@/lib/format";
import type { Service } from "@/mocks/types";
import { toast } from "sonner";

export function HealthcheckPage() {
  const t = useT();
  const qc = useQueryClient();
  const { data: services = [], isLoading } = useQuery({ queryKey: ["services"], queryFn: api.services, refetchInterval: 3000 });
  const { data: alerts = [] } = useQuery({ queryKey: ["alerts", "history"], queryFn: api.alerts.history, refetchInterval: 3000 });
  const [period, setPeriod] = useState<"1h" | "24h" | "7d">("24h");

  const recheck = (slug: string) => {
    toast.info(`Re-checking ${slug}…`);
    setTimeout(() => {
      qc.setQueryData<Service[]>(["services"], (prev) => prev?.map((s) => s.slug === slug ? { ...s, responseTime: 20 + Math.random() * 60 } : s));
      toast.success(`${slug} ok`);
    }, 600);
  };

  const cols: Column<Service>[] = [
    {
      key: "name", header: "Service", sort: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <TechIcon slug={r.slug} name={r.name} size={24} />
          <div className="min-w-0">
            <p className="font-medium truncate">{r.name}</p>
            <p className="text-[10px] text-muted-foreground font-mono truncate">{r.health_url}</p>
          </div>
        </div>
      )
    },
    { key: "category", header: "Category", sort: (r) => r.category, cell: (r) => <span className="text-xs">{r.category}</span> },
    { key: "status", header: "Status", sort: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { key: "rt", header: "Latency", sort: (r) => r.responseTime, className: "text-right tabular-nums", cell: (r) => r.responseTime > 0 ? ms(r.responseTime) : "—" },
    { key: "type", header: "Type", sort: (r) => r.health_type, cell: (r) => <span className="text-xs font-mono">{r.health_type}</span> },
    { key: "act", header: "", cell: (r) => <Button size="sm" variant="ghost" onClick={() => recheck(r.slug)}><RefreshCw className="size-3.5" /></Button>, className: "text-right w-[60px]" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.nav.healthcheck}
        description="Periodic probes across all registered services."
        actions={
          <div className="flex gap-1 border rounded-md p-0.5 bg-muted/30">
            {(["1h", "24h", "7d"] as const).map((p) => (
              <Button key={p} size="sm" variant={period === p ? "default" : "ghost"} className="h-7 px-3" onClick={() => setPeriod(p)}>{p}</Button>
            ))}
          </div>
        }
      />

      <DataTable
        columns={cols}
        initialSort="status"
        server={{ queryKey: ["healthcheck"], fetch: api.healthcheckList, refetchInterval: 3000 }}
      />


      <Card className="elev-1">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Incident timeline</CardTitle></CardHeader>
        <CardContent>
          <ol className="relative border-l ml-2 space-y-3">
            {alerts.slice(0, 12).map((a) => (
              <li key={a.id} className="pl-4 relative">
                <span className="absolute -left-1.5 top-1.5 size-3 rounded-full ring-4 ring-background" style={{
                  background: a.status === "fired" ? "var(--destructive)" : a.status === "resolved" ? "var(--success)" : "var(--primary)",
                }} />
                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="font-medium">{a.ruleName}</span>
                  <span className="text-xs text-muted-foreground">{a.serviceName}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{relativeTime(a.timestamp)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{a.message}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="elev-1">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Live log stream</CardTitle></CardHeader>
        <CardContent><LogStream height={360} /></CardContent>
      </Card>
    </div>
  );
}
