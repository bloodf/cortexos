import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Play, RotateCw, Square, Trash2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { TechIcon } from "@/components/TechIcon";
import { LogStream } from "@/components/LogStream";
import { TimeRangeAreaTrend } from "@/components/TimeRangeAreaTrend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/EmptyState";
import { api, callDockerAction, callMintApproval } from "@/lib/api/client";
import { useAuth } from "@/hooks/useAuth";
import { bytes, relativeTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Approval-gated docker action helper (mirrors Docker.tsx)
// ---------------------------------------------------------------------------

async function dispatchDockerAction(
  op: string,
  args: Record<string, unknown>,
): Promise<void> {
  const mint = await callMintApproval({
    data: { action: op, payload: { op, args } },
  });
  await callDockerAction({
    data: { op, args, approvalToken: mint.token },
  });
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/_authenticated/docker/$id")({
  loader: async ({ params }) => {
    const containers = await api.docker.containers();
    const found = containers.find((c) => c.id === params.id || c.name === params.id);
    if (!found) throw notFound();
    return { container: found };
  },
  errorComponent: ({ error, reset }) => (
    <div className="p-6 space-y-4">
      <PageHeader title="Container error" description={error?.message ?? "Failed to load"} />
      <Button onClick={reset}>Retry</Button>
    </div>
  ),
  notFoundComponent: () => {
    const { id } = useParams({ from: "/_authenticated/docker/$id" });
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title="Container not found"
          description={`No container matched "${id}".`}
        />
        <Button asChild variant="outline">
          <Link to="/docker">
            <ArrowLeft className="size-4 mr-1" />
            Back to Docker
          </Link>
        </Button>
      </div>
    );
  },
  component: ContainerDetail,
});

function ContainerDetail() {
  const { id } = useParams({ from: "/_authenticated/docker/$id" });
  const qc = useQueryClient();
  const { user } = useAuth();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const {
    data: containers = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["docker", "containers"],
    queryFn: api.docker.containers,
    refetchInterval: 10_000,
  });

  const c = containers.find((x) => x.id === id || x.name === id);
  const isAdmin = !!user?.is_admin;

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["docker", "containers"] });

  const handleStart = async () => {
    if (!c) return;
    setPendingAction("start");
    try {
      await dispatchDockerAction("docker.start", { container: c.id });
      toast.success(`Started ${c.name}`);
      await invalidate();
    } catch {
      toast.error(`Failed to start ${c.name}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleStop = async () => {
    if (!c) return;
    setPendingAction("stop");
    try {
      await dispatchDockerAction("docker.stop", { container: c.id });
      toast.success(`Stopped ${c.name}`);
      await invalidate();
    } catch {
      toast.error(`Failed to stop ${c.name}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleRestart = async () => {
    if (!c) return;
    setPendingAction("restart");
    try {
      await dispatchDockerAction("docker.restart", { container: c.id });
      toast.success(`Restarted ${c.name}`);
      await invalidate();
    } catch {
      toast.error(`Failed to restart ${c.name}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleRemove = async () => {
    if (!c) return;
    setPendingAction("rm");
    try {
      await dispatchDockerAction("docker.rm", { container: c.id });
      toast.success(`Removed ${c.name}`);
      void qc.invalidateQueries({ queryKey: ["docker", "containers"] });
    } catch {
      toast.error(`Failed to remove ${c.name}`);
    } finally {
      setPendingAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/docker">
            <ArrowLeft className="size-3.5 mr-1" />
            Docker
          </Link>
        </Button>
        <DetailSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 p-6">
        <EmptyState
          title="Failed to load container"
          description="Could not reach Docker. Check that the Docker daemon is running."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => qc.invalidateQueries({ queryKey: ["docker", "containers"] })}
            >
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!c) return null;

  const acting = pendingAction !== null;

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/docker">
          <ArrowLeft className="size-3.5 mr-1" />
          Docker
        </Link>
      </Button>

      <PageHeader
        icon={<TechIcon slug={c.name} name={c.name} size={36} />}
        title={c.name}
        description={`${c.image} · ${c.status}`}
        actions={
          <div className="flex gap-2">
            <Badge
              variant="outline"
              className={cn(
                c.state === "running" && "border-[var(--success)] text-[var(--success)]",
                c.state === "exited" && "border-destructive text-destructive",
              )}
            >
              {c.state}
            </Badge>
            {isAdmin && c.state !== "running" && (
              <Button size="sm" variant="outline" disabled={acting} onClick={handleStart}>
                {pendingAction === "start" ? (
                  <Loader2 className="size-3.5 mr-1 animate-spin" />
                ) : (
                  <Play className="size-3.5 mr-1" />
                )}
                Start
              </Button>
            )}
            {isAdmin && c.state === "running" && (
              <Button size="sm" variant="outline" disabled={acting} onClick={handleStop}>
                {pendingAction === "stop" ? (
                  <Loader2 className="size-3.5 mr-1 animate-spin" />
                ) : (
                  <Square className="size-3.5 mr-1" />
                )}
                Stop
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" variant="outline" disabled={acting} onClick={handleRestart}>
                {pendingAction === "restart" ? (
                  <Loader2 className="size-3.5 mr-1 animate-spin" />
                ) : (
                  <RotateCw className="size-3.5 mr-1" />
                )}
                Restart
              </Button>
            )}
            {isAdmin && (
              <ConfirmDialog
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting}
                    className="text-destructive hover:text-destructive border-destructive/40"
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    Remove
                  </Button>
                }
                title={`Remove container ${c.name}?`}
                description="This will permanently remove the container. Volumes are kept."
                destructive
                requireText={c.name}
                confirmLabel="Remove"
                onConfirm={handleRemove}
              />
            )}
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
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>
        <TabsContent value="metrics" className="pt-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground mb-1">CPU (host trend)</div>
            <TimeRangeAreaTrend
              data={[]}
              series={[{ key: "cpu", color: "var(--primary)", name: "CPU %" }]}
            />
          </div>
        </TabsContent>
        <TabsContent value="logs" className="pt-4">
          <LogStream height={480} />
        </TabsContent>
        <TabsContent value="config" className="pt-4">
          <pre className="rounded-lg border bg-card p-4 text-xs overflow-x-auto">
            {JSON.stringify(c, null, 2)}
          </pre>
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
