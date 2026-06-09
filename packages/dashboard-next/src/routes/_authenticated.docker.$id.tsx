import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, RotateCw, Square, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { TechIcon } from "@/components/TechIcon";
import { LogStream } from "@/components/LogStream";
import { TimeRangeAreaTrend } from "@/components/TimeRangeAreaTrend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/mocks/api";
import { useAuth } from "@/hooks/useAuth";
import { bytes, relativeTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/docker/$id")({
  loader: async ({ params }) => {
    const containers = await api.docker.containers();
    const found = containers.find((c) => c.id === params.id || c.name === params.id);
    if (!found) throw notFound();
    return { container: found };
  },
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <PageHeader title="Container error" description={error?.message ?? "Failed to load"} />
      <Button onClick={reset}>Retry</Button>
    </div>
  ),
  notFoundComponent: () => {
    const { id } = useParams({ from: "/_authenticated/docker/$id" });
    return (
      <div className="p-6">
        <PageHeader title="Container not found" description={`No container matched "${id}".`} />
        <Button asChild variant="outline"><Link to="/docker"><ArrowLeft className="size-4 mr-1" />Back to Docker</Link></Button>
      </div>
    );
  },
  component: ContainerDetail,
});

function ContainerDetail() {
  const { id } = useParams({ from: "/_authenticated/docker/$id" });
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: containers = [] } = useQuery({ queryKey: ["docker", "containers"], queryFn: api.docker.containers });
  const { data: history = [] } = useQuery({ queryKey: ["history"], queryFn: api.history });

  const c = containers.find((x) => x.id === id || x.name === id);
  if (!c) return null;

  const isAdmin = !!user?.is_admin;
  const trendData = (history as { t: number; cpu: number }[]);
  void qc;

  const setState = (state: typeof c.state) => {
    qc.setQueryData<typeof containers>(["docker", "containers"], (p) => p?.map((x) => x.id === c.id ? { ...x, state, status: state === "running" ? "Up just now" : "Exited (0) just now" } : x));
    toast.success(`${c.name} ${state === "running" ? "started" : state === "exited" ? "stopped" : "updated"}`);
  };

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/docker"><ArrowLeft className="size-3.5 mr-1" />Docker</Link></Button>

      <PageHeader
        icon={<TechIcon slug={c.name} name={c.name} size={36} />}
        title={c.name}
        description={`${c.image} · ${c.status}`}
        actions={
          <div className="flex gap-2">
            <Badge variant="outline" className={cn(
              c.state === "running" && "border-[var(--success)] text-[var(--success)]",
              c.state === "exited" && "border-destructive text-destructive",
            )}>{c.state}</Badge>
            {isAdmin && c.state !== "running" && <Button size="sm" variant="outline" onClick={() => setState("running")}><Play className="size-3.5 mr-1" />Start</Button>}
            {isAdmin && c.state === "running" && <Button size="sm" variant="outline" onClick={() => setState("exited")}><Square className="size-3.5 mr-1" />Stop</Button>}
            {isAdmin && <Button size="sm" variant="outline" onClick={() => { setState("exited"); setTimeout(() => setState("running"), 400); }}><RotateCw className="size-3.5 mr-1" />Restart</Button>}
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <Stat label="State" value={c.state} />
        <Stat label="Ports" value={c.ports || "—"} />
        <Stat label="Created" value={relativeTime(c.created)} />
      </div>

      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="env">Environment</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>
        <TabsContent value="metrics" className="pt-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1">CPU (host trend)</div>
            <TimeRangeAreaTrend data={trendData} series={[{ key: "cpu", color: "var(--primary)", name: "CPU %" }]} />
          </div>
        </TabsContent>
        <TabsContent value="logs" className="pt-4"><LogStream /></TabsContent>
        <TabsContent value="env" className="pt-4">
          <div className="rounded-lg border bg-card divide-y font-mono text-xs">
            {[`NODE_ENV=production`, `LOG_LEVEL=info`, `PORT=8080`, `DATA_DIR=/var/lib/${c.name}`].map((kv) => (
              <div key={kv} className="px-3 py-2 truncate">{kv}</div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="config" className="pt-4">
          <pre className="rounded-lg border bg-card p-4 text-xs overflow-x-auto">{JSON.stringify(c, null, 2)}</pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
