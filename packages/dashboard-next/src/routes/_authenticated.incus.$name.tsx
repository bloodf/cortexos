import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, RotateCw, Square, Boxes } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/CodeBlock";
import { KeyValueList } from "@/components/KeyValueList";
import { LogStream } from "@/components/LogStream";
import { TimeRangeAreaTrend } from "@/components/TimeRangeAreaTrend";
import { DiffViewer } from "@/components/DiffViewer";
import { api } from "@/mocks/api";
import { useAuth } from "@/hooks/useAuth";
import { bytes, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/incus/$name")({
  loader: async ({ params }) => {
    const all = await api.incus();
    const found = all.find((i) => i.name === params.name || i.slug === params.name);
    if (!found) throw notFound();
    return { instance: found };
  },
  notFoundComponent: () => {
    const { name } = useParams({ from: "/_authenticated/incus/$name" });
    return (
      <div className="p-6">
        <PageHeader title="Instance not found" description={`No Incus instance matched "${name}".`} />
        <Button asChild variant="outline"><Link to="/incus"><ArrowLeft className="size-4 mr-1" />Back to Incus</Link></Button>
      </div>
    );
  },
  component: IncusDetail,
});

function IncusDetail() {
  const { name } = useParams({ from: "/_authenticated/incus/$name" });
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: instances = [] } = useQuery({ queryKey: ["incus"], queryFn: api.incus });
  const { data: history = [] } = useQuery({ queryKey: ["history"], queryFn: api.history });
  const inst = instances.find((i) => i.name === name || i.slug === name);
  if (!inst) return null;
  const isAdmin = !!user?.is_admin;

  const setStatus = (status: typeof inst.status) => {
    qc.setQueryData<typeof instances>(["incus"], (p) => p?.map((x) => x.name === inst.name ? { ...x, status } : x));
    toast.success(`${inst.name} marked ${status}`);
  };

  const beforeCfg = Object.entries(inst.config).map(([k, v]) => `${k}: ${v}`).join("\n");
  const afterCfg = beforeCfg.replace(/limits\.cpu: \d+/, `limits.cpu: ${inst.cpu + 1}`) + "\nsecurity.nesting: true";

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/incus"><ArrowLeft className="size-3.5 mr-1" />Incus</Link></Button>
      <PageHeader
        icon={<Boxes className="size-5" />}
        title={inst.name}
        description={`${inst.type} · ${inst.image}`}
        actions={
          <div className="flex gap-2">
            <Badge variant="outline" className={cn(
              inst.status === "active" && "border-[var(--success)] text-[var(--success)]",
              inst.status === "failed" && "border-destructive text-destructive",
            )}>{inst.status}</Badge>
            {isAdmin && inst.status !== "active" && <Button size="sm" variant="success" onClick={() => setStatus("active")}><Play className="size-3.5 mr-1" />Start</Button>}
            {isAdmin && inst.status === "active" && <Button size="sm" variant="destructive" onClick={() => setStatus("draft")}><Square className="size-3.5 mr-1" />Stop</Button>}
            {isAdmin && <Button size="sm" variant="warning" onClick={() => { setStatus("provisioning"); setTimeout(() => setStatus("active"), 600); }}><RotateCw className="size-3.5 mr-1" />Restart</Button>}
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="diff">Pending changes</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <KeyValueList items={[
            { key: "Type", value: inst.type },
            { key: "Image", value: inst.image },
            { key: "CPU", value: inst.cpu },
            { key: "Memory", value: bytes(inst.memory * 1024 * 1024) },
            { key: "Created", value: relativeTime(inst.created_at) },
            { key: "Validation", value: inst.last_validation?.notes ?? "—" },
          ]} />
        </TabsContent>
        <TabsContent value="metrics" className="pt-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1">CPU & Memory</div>
            <TimeRangeAreaTrend
              data={history as { t: number; cpu: number; mem: number }[]}
              series={[
                { key: "cpu", color: "var(--primary)", name: "CPU %" },
                { key: "mem", color: "var(--chart-2)", name: "Mem %" },
              ]}
            />
          </div>
        </TabsContent>
        <TabsContent value="logs" className="pt-4"><LogStream /></TabsContent>
        <TabsContent value="config" className="pt-4">
          <CodeBlock language="yaml" code={beforeCfg} />
        </TabsContent>
        <TabsContent value="diff" className="pt-4">
          <DiffViewer before={beforeCfg} after={afterCfg} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
