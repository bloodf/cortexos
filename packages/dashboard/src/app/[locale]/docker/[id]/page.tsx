"use client";

import { useParams } from "next/navigation";
import { ArrowLeft, Play, Square, RotateCw, Container } from "lucide-react";
import { Link } from "@/i18n/routing";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { KeyValueList } from "@/components/sys-pilot/KeyValueList";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { relativeTime } from "@/lib/sys-pilot/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function DockerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;

  const { data: containers = [], isLoading } = useQuery({
    queryKey: ["docker", "containers"],
    queryFn: api.docker.containers,
  });

  const container = containers.find((c) => c.id === id);

  async function runAction(action: "start" | "stop" | "restart") {
    if (!container) return;
    const verb = action === "start" ? "Starting" : action === "stop" ? "Stopping" : "Restarting";
    toast.info(`${verb} ${container.name}…`);
    try {
      const res = await fetch("/api/docker/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, name: container.name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to ${action} ${container.name}`);
      }
      toast.success(`${action === "start" ? "Started" : action === "stop" ? "Stopped" : "Restarted"} ${container.name}`);
      await qc.invalidateQueries({ queryKey: ["docker", "containers"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to ${action} ${container.name}`);
    }
  }

  const header = (
    <PageHeader
      icon={
        <Link href="/docker" aria-label="Back to Docker" className="text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
      }
      title={container ? container.name : "Container"}
      description={container ? container.image : id}
      actions={
        container && isAdmin ? (
          <div className="flex gap-1">
            {container.state !== "running" ? (
              <Button size="sm" variant="outline" onClick={() => runAction("start")}><Play className="size-3.5 mr-1" />Start</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => runAction("stop")}><Square className="size-3.5 mr-1" />Stop</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => runAction("restart")}><RotateCw className="size-3.5 mr-1" />Restart</Button>
          </div>
        ) : undefined
      }
    />
  );

  if (!container) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          {isLoading ? "Loading container…" : `No container found for "${id}".`}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="p-6">
            <KeyValueList
              items={[
                { key: "Name", value: container.name },
                { key: "ID", value: <code className="text-xs">{container.id}</code> },
                { key: "Image", value: <code className="text-xs">{container.image}</code> },
                {
                  key: "State",
                  value: (
                    <Badge
                      variant="outline"
                      className={cn(
                        container.state === "running" && "border-[var(--success)] text-[var(--success)]",
                        container.state === "exited" && "border-[var(--destructive)] text-[var(--destructive)]",
                        container.state === "restarting" && "border-[var(--warning)] text-[var(--warning)]",
                      )}
                    >
                      {container.state}
                    </Badge>
                  ),
                },
                { key: "Status", value: container.status },
                { key: "Ports", value: container.ports ? <code className="text-xs">{container.ports}</code> : "—" },
                { key: "Created", value: relativeTime(container.created) },
              ]}
            />
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Container className="size-5 opacity-60" />
            <span>Live container logs are not available — no log endpoint is exposed by the backend.</span>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
