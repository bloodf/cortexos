import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Play, Square, RotateCw, Trash2, FileText, Container, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailDrawer } from "@/components/DetailDrawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/EmptyState";
import { api, callDockerAction, callMintApproval, callContainerLogs } from "@/lib/api/client";
import { useT } from "@/hooks/useT";
import { useAuth } from "@/hooks/useAuth";
import { bytes, relativeTime } from "@/lib/format";
import type { DockerContainer, DockerImage, DockerVolume } from "@/mocks/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LogStream } from "@/components/LogStream";

// ---------------------------------------------------------------------------
// Approval-gated docker action helper
// ---------------------------------------------------------------------------

/**
 * Mint an approval token then dispatch the docker action.
 * The bridge (PB-5) requires a valid token for every op.
 * On error, surfaces a user-facing toast and re-throws so callers can reset state.
 */
async function dispatchDockerAction(
  op: string,
  args: Record<string, unknown>,
): Promise<void> {
  // 1. Mint a single-use approval token for this exact op+args.
  const mint = await callMintApproval({
    data: { action: op, payload: { op, args } },
  });

  // 2. Dispatch via dockerAction, passing the token.
  await callDockerAction({
    data: { op, args, approvalToken: mint.token },
  });
}

export function DockerPage() {
  const t = useT();
  const qc = useQueryClient();
  const { user } = useAuth();
  const {
    data: containers = [],
    isLoading: lc,
    isError: ec,
  } = useQuery({
    queryKey: ["docker", "containers"],
    queryFn: api.docker.containers,
    refetchInterval: 10_000,
  });
  const {
    data: images = [],
    isLoading: li,
    isError: ei,
  } = useQuery({
    queryKey: ["docker", "images"],
    queryFn: api.docker.images,
    refetchInterval: 30_000,
  });
  const {
    data: volumes = [],
    isLoading: lv,
    isError: ev,
  } = useQuery({
    queryKey: ["docker", "volumes"],
    queryFn: api.docker.volumes,
    refetchInterval: 30_000,
  });
  const [logsFor, setLogsFor] = useState<DockerContainer | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // MP-009: per-container log fetcher. Captures `logsFor` (the container
  // currently in the drawer) at render time; the LogStream re-runs the
  // callback when the drawer content changes (logsFor is in the dep array).
  const fetchContainerLogs = useCallback(async (): Promise<string[]> => {
    if (!logsFor) return [];
    try {
      const { lines } = await callContainerLogs({ data: { id: logsFor.id, limit: 200 } });
      return lines;
    } catch {
      return [];
    }
  }, [logsFor]);

  const isAdmin = !!user?.is_admin;

  const invalidateContainers = () => {
    void qc.invalidateQueries({ queryKey: ["docker", "containers"] });
  };

  const handleStart = async (c: DockerContainer) => {
    const key = `start-${c.id}`;
    setPendingAction(key);
    try {
      await dispatchDockerAction("docker.start", { container: c.id });
      toast.success(`Started ${c.name}`);
      invalidateContainers();
    } catch {
      toast.error(`Failed to start ${c.name}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleStop = async (c: DockerContainer) => {
    const key = `stop-${c.id}`;
    setPendingAction(key);
    try {
      await dispatchDockerAction("docker.stop", { container: c.id });
      toast.success(`Stopped ${c.name}`);
      invalidateContainers();
    } catch {
      toast.error(`Failed to stop ${c.name}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleRestart = async (c: DockerContainer) => {
    const key = `restart-${c.id}`;
    setPendingAction(key);
    try {
      await dispatchDockerAction("docker.restart", { container: c.id });
      toast.success(`Restarted ${c.name}`);
      invalidateContainers();
    } catch {
      toast.error(`Failed to restart ${c.name}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleRemove = async (c: DockerContainer) => {
    const key = `rm-${c.id}`;
    setPendingAction(key);
    try {
      await dispatchDockerAction("docker.rm", { container: c.id });
      toast.success(`Removed ${c.name}`);
      invalidateContainers();
    } catch {
      toast.error(`Failed to remove ${c.name}`);
    } finally {
      setPendingAction(null);
    }
  };

  const containerCols: Column<DockerContainer>[] = [
    {
      key: "name",
      header: "Name",
      sort: (r) => r.name,
      cell: (r) => (
        <a href={`/docker/${r.id}`} className="font-medium hover:underline">
          {r.name}
        </a>
      ),
    },
    {
      key: "image",
      header: "Image",
      sort: (r) => r.image,
      cell: (r) => <code className="text-xs">{r.image}</code>,
    },
    {
      key: "state",
      header: "State",
      sort: (r) => r.state,
      cell: (r) => (
        <Badge
          variant="outline"
          className={cn(
            r.state === "running" && "border-[var(--success)] text-[var(--success)]",
            r.state === "exited" && "border-[var(--destructive)] text-[var(--destructive)]",
            r.state === "restarting" && "border-[var(--warning)] text-[var(--warning)]",
          )}
        >
          {r.state}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <span className="text-xs text-muted-foreground">{r.status}</span>,
    },
    {
      key: "ports",
      header: "Ports",
      cell: (r) => <code className="text-xs">{r.ports}</code>,
    },
    {
      key: "act",
      header: "",
      className: "text-right",
      cell: (r) => {
        const isActing = pendingAction?.startsWith(r.id) ?? false;
        return (
          <div className="flex gap-1 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setLogsFor(r)}
              title="Logs"
            >
              <FileText className="size-3.5" />
            </Button>
            {r.state !== "running" ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={!isAdmin || isActing}
                onClick={() => handleStart(r)}
                title="Start"
              >
                {isActing && pendingAction === `start-${r.id}` ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={!isAdmin || isActing}
                onClick={() => handleStop(r)}
                title="Stop"
              >
                {isActing && pendingAction === `stop-${r.id}` ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Square className="size-3.5" />
                )}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={!isAdmin || isActing}
              onClick={() => handleRestart(r)}
              title="Restart"
            >
              {isActing && pendingAction === `restart-${r.id}` ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RotateCw className="size-3.5" />
              )}
            </Button>
            <ConfirmDialog
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!isAdmin || isActing}
                  className="text-destructive hover:text-destructive"
                  title="Remove"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              }
              title={`Remove container ${r.name}?`}
              description="This will permanently remove the container. Volumes are kept."
              destructive
              requireText={r.name}
              confirmLabel="Remove"
              onConfirm={() => handleRemove(r)}
            />
          </div>
        );
      },
    },
  ];

  const imageCols: Column<DockerImage>[] = [
    {
      key: "repo",
      header: "Repository",
      sort: (r) => r.repo,
      cell: (r) => <span className="font-mono text-xs">{r.repo}</span>,
    },
    {
      key: "tag",
      header: "Tag",
      sort: (r) => r.tag,
      cell: (r) => <Badge variant="secondary">{r.tag}</Badge>,
    },
    {
      key: "size",
      header: "Size",
      sort: (r) => r.size,
      className: "text-right tabular-nums",
      cell: (r) => bytes(r.size),
    },
    {
      key: "created",
      header: "Created",
      sort: (r) => r.created,
      cell: (r) => <span className="text-xs text-muted-foreground">{relativeTime(r.created)}</span>,
    },
    {
      key: "id",
      header: "ID",
      cell: (r) => <code className="text-[10px] text-muted-foreground">{r.id.slice(7, 19)}</code>,
    },
  ];

  const volumeCols: Column<DockerVolume>[] = [
    {
      key: "name",
      header: "Name",
      sort: (r) => r.name,
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: "driver",
      header: "Driver",
      cell: (r) => <Badge variant="outline">{r.driver}</Badge>,
    },
    {
      key: "mount",
      header: "Mountpoint",
      cell: (r) => <code className="text-[10px] text-muted-foreground">{r.mountpoint}</code>,
    },
    {
      key: "size",
      header: "Size",
      sort: (r) => r.size,
      className: "text-right tabular-nums",
      cell: (r) => bytes(r.size),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Container className="size-5" />}
        title={t.nav.docker}
        description={`${containers.filter((c) => c.state === "running").length} running · ${images.length} images · ${volumes.length} volumes`}
        actions={isAdmin ? <Button size="sm" variant="outline">Pull image…</Button> : undefined}
      />

      <Tabs defaultValue="containers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="containers">Containers ({containers.length})</TabsTrigger>
          <TabsTrigger value="images">Images ({images.length})</TabsTrigger>
          <TabsTrigger value="volumes">Volumes ({volumes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="containers">
          {lc ? (
            <TableSkeleton rows={6} cols={5} />
          ) : ec ? (
            <EmptyState
              title="Failed to load containers"
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
          ) : (
            <DataTable
              columns={containerCols}
              initialSort="name"
              server={{ queryKey: ["docker", "containers"], fetch: api.docker.containersList }}
            />
          )}
        </TabsContent>

        <TabsContent value="images">
          {li ? (
            <TableSkeleton rows={6} cols={5} />
          ) : ei ? (
            <EmptyState
              title="Failed to load images"
              description="Could not reach Docker. Check that the Docker daemon is running."
            />
          ) : (
            <DataTable
              columns={imageCols}
              initialSort="repo"
              server={{ queryKey: ["docker", "images"], fetch: api.docker.imagesList }}
            />
          )}
        </TabsContent>

        <TabsContent value="volumes">
          {lv ? (
            <TableSkeleton rows={4} cols={4} />
          ) : ev ? (
            <EmptyState
              title="Failed to load volumes"
              description="Could not reach Docker. Check that the Docker daemon is running."
            />
          ) : (
            <DataTable
              columns={volumeCols}
              initialSort="name"
              server={{ queryKey: ["docker", "volumes"], fetch: api.docker.volumesList }}
            />
          )}
        </TabsContent>
      </Tabs>

      <DetailDrawer
        open={!!logsFor}
        onOpenChange={(o) => !o && setLogsFor(null)}
        title={logsFor ? <span className="font-mono">{logsFor.name}</span> : ""}
        description={logsFor ? `${logsFor.image} · ${logsFor.status}` : ""}
        tabs={[
          {
            id: "logs",
            label: "Logs",
            content: logsFor ? <LogStream height={420} fetcher={fetchContainerLogs} refetchIntervalMs={3000} /> : null,
          },
        ]}
      />
    </div>
  );
}
