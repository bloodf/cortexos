import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, RotateCw, Square, Server } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyValueList } from "@/components/KeyValueList";
import { LogStream } from "@/components/LogStream";
import { CodeBlock } from "@/components/CodeBlock";
import { api } from "@/mocks/api";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/systemd/$unit")({
  loader: async ({ params }) => {
    const all = await api.systemd();
    const found = all.find((u) => u.name === params.unit);
    if (!found) throw notFound();
    return { unit: found };
  },
  notFoundComponent: () => {
    const { unit } = useParams({ from: "/_authenticated/systemd/$unit" });
    return (
      <div className="p-6">
        <PageHeader title="Unit not found" description={`No systemd unit matched "${unit}".`} />
        <Button asChild variant="outline"><Link to="/systemd"><ArrowLeft className="size-4 mr-1" />Back to Systemd</Link></Button>
      </div>
    );
  },
  component: SystemdDetail,
});

function SystemdDetail() {
  const { unit: unitName } = useParams({ from: "/_authenticated/systemd/$unit" });
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: units = [] } = useQuery({ queryKey: ["systemd"], queryFn: api.systemd });
  const u = units.find((x) => x.name === unitName);
  if (!u) return null;
  const isAdmin = !!user?.is_admin;

  const setActive = (active: typeof u.active) => {
    qc.setQueryData<typeof units>(["systemd"], (p) => p?.map((x) => x.name === u.name ? { ...x, active, sub: active === "active" ? "running" : "dead" } : x));
    toast.success(`${u.name} ${active === "active" ? "started" : "stopped"}`);
  };

  const unitFile = `[Unit]
Description=${u.description}
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/${u.name.replace(".service", "")} --serve
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target`;

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/systemd"><ArrowLeft className="size-3.5 mr-1" />Systemd</Link></Button>
      <PageHeader
        icon={<Server className="size-5" />}
        title={u.name}
        description={u.description}
        actions={
          <div className="flex gap-2">
            <Badge variant="outline" className={cn(
              u.active === "active" && "border-[var(--success)] text-[var(--success)]",
              u.active === "failed" && "border-destructive text-destructive",
            )}>{u.active}</Badge>
            {isAdmin && u.active !== "active" && <Button size="sm" variant="outline" onClick={() => setActive("active")}><Play className="size-3.5 mr-1" />Start</Button>}
            {isAdmin && u.active === "active" && <Button size="sm" variant="outline" onClick={() => setActive("inactive")}><Square className="size-3.5 mr-1" />Stop</Button>}
            {isAdmin && <Button size="sm" variant="outline" onClick={() => { setActive("inactive"); setTimeout(() => setActive("active"), 400); }}><RotateCw className="size-3.5 mr-1" />Restart</Button>}
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Journal</TabsTrigger>
          <TabsTrigger value="unit">Unit file</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <KeyValueList items={[
            { key: "Load", value: u.load },
            { key: "Active", value: u.active },
            { key: "Sub", value: u.sub },
            { key: "Enabled at boot", value: u.enabled ? "yes" : "no" },
          ]} />
        </TabsContent>
        <TabsContent value="logs" className="pt-4"><LogStream /></TabsContent>
        <TabsContent value="unit" className="pt-4"><CodeBlock language="ini" code={unitFile} /></TabsContent>
      </Tabs>
    </div>
  );
}
