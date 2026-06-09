import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Play, Square, RotateCw, Trash2, FileText, Container } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailDrawer, MockLogs, MockMetrics, MockEnv } from "@/components/DetailDrawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/mocks/api";
import { useT } from "@/hooks/useT";
import { useAuth } from "@/hooks/useAuth";
import { bytes, relativeTime } from "@/lib/format";
import type { DockerContainer, DockerImage, DockerVolume } from "@/mocks/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SAMPLE_LOGS = [
  "[2026-05-30T07:00:01Z] INFO  ollama: starting llama3.1:70b",
  "[2026-05-30T07:00:03Z] INFO  ollama: model loaded, listening on :11434",
  "[2026-05-30T07:01:12Z] INFO  ollama: inference req=q-7821 tokens=128",
  "[2026-05-30T07:02:44Z] WARN  ollama: GPU memory pressure 92%",
  "[2026-05-30T07:03:55Z] INFO  ollama: inference req=q-7822 tokens=64",
  "[2026-05-30T07:05:01Z] ERROR ollama: failed to load adapter foo: not found",
  "[2026-05-30T07:05:10Z] INFO  ollama: continuing without adapter",
];

export function DockerPage() {
  const t = useT();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: containers = [], isLoading: lc } = useQuery({ queryKey: ["docker", "containers"], queryFn: api.docker.containers });
  const { data: images = [], isLoading: li } = useQuery({ queryKey: ["docker", "images"], queryFn: api.docker.images });
  const { data: volumes = [], isLoading: lv } = useQuery({ queryKey: ["docker", "volumes"], queryFn: api.docker.volumes });
  const [logsFor, setLogsFor] = useState<DockerContainer | null>(null);

  const isAdmin = !!user?.is_admin;

  const updateState = (id: string, state: DockerContainer["state"]) => {
    qc.setQueryData<DockerContainer[]>(["docker", "containers"], (p) => p?.map((c) => c.id === id ? { ...c, state, status: state === "running" ? "Up just now" : "Exited (0) just now" } : c));
  };

  const containerCols: Column<DockerContainer>[] = [
    { key: "name", header: "Name", sort: (r) => r.name, cell: (r) => <a href={`/docker/${r.id}`} className="font-medium hover:underline">{r.name}</a> },
    { key: "image", header: "Image", sort: (r) => r.image, cell: (r) => <code className="text-xs">{r.image}</code> },
    {
      key: "state", header: "State", sort: (r) => r.state,
      cell: (r) => <Badge variant="outline" className={cn(
        r.state === "running" && "border-[var(--success)] text-[var(--success)]",
        r.state === "exited" && "border-[var(--destructive)] text-[var(--destructive)]",
        r.state === "restarting" && "border-[var(--warning)] text-[var(--warning)]",
      )}>{r.state}</Badge>
    },
    { key: "status", header: "Status", cell: (r) => <span className="text-xs text-muted-foreground">{r.status}</span> },
    { key: "ports", header: "Ports", cell: (r) => <code className="text-xs">{r.ports}</code> },
    {
      key: "act", header: "", className: "text-right",
      cell: (r) => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => setLogsFor(r)} title="Logs"><FileText className="size-3.5" /></Button>
          {r.state !== "running" ? (
            <Button size="sm" variant="ghost" disabled={!isAdmin} onClick={() => { updateState(r.id, "running"); toast.success(`Started ${r.name}`); }}><Play className="size-3.5" /></Button>
          ) : (
            <Button size="sm" variant="ghost" disabled={!isAdmin} onClick={() => { updateState(r.id, "exited"); toast.success(`Stopped ${r.name}`); }}><Square className="size-3.5" /></Button>
          )}
          <Button size="sm" variant="ghost" disabled={!isAdmin} onClick={() => { toast.info(`Restarting ${r.name}…`); updateState(r.id, "running"); }}><RotateCw className="size-3.5" /></Button>
          <ConfirmDialog
            trigger={<Button size="sm" variant="ghost" disabled={!isAdmin} className="text-destructive hover:text-destructive"><Trash2 className="size-3.5" /></Button>}
            title={`Remove container ${r.name}?`}
            description="This will permanently remove the container. Volumes are kept."
            destructive
            requireText={r.name}
            confirmLabel="Remove"
            onConfirm={() => { qc.setQueryData<DockerContainer[]>(["docker", "containers"], (p) => p?.filter((c) => c.id !== r.id)); toast.success(`Removed ${r.name}`); }}
          />
        </div>
      ),
    },
  ];

  const imageCols: Column<DockerImage>[] = [
    { key: "repo", header: "Repository", sort: (r) => r.repo, cell: (r) => <span className="font-mono text-xs">{r.repo}</span> },
    { key: "tag", header: "Tag", sort: (r) => r.tag, cell: (r) => <Badge variant="secondary">{r.tag}</Badge> },
    { key: "size", header: "Size", sort: (r) => r.size, className: "text-right tabular-nums", cell: (r) => bytes(r.size) },
    { key: "created", header: "Created", sort: (r) => r.created, cell: (r) => <span className="text-xs text-muted-foreground">{relativeTime(r.created)}</span> },
    { key: "id", header: "ID", cell: (r) => <code className="text-[10px] text-muted-foreground">{r.id.slice(7, 19)}</code> },
  ];
  const volumeCols: Column<DockerVolume>[] = [
    { key: "name", header: "Name", sort: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "driver", header: "Driver", cell: (r) => <Badge variant="outline">{r.driver}</Badge> },
    { key: "mount", header: "Mountpoint", cell: (r) => <code className="text-[10px] text-muted-foreground">{r.mountpoint}</code> },
    { key: "size", header: "Size", sort: (r) => r.size, className: "text-right tabular-nums", cell: (r) => bytes(r.size) },
  ];

  return (
    <div className="space-y-5">
      <PageHeader icon={<Container className="size-5" />} title={t.nav.docker}
        description={`${containers.filter((c) => c.state === "running").length} running · ${images.length} images · ${volumes.length} volumes`}
        actions={isAdmin ? <Button size="sm" variant="outline">Pull image…</Button> : undefined}
      />

      <Tabs defaultValue="containers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="containers">Containers ({containers.length})</TabsTrigger>
          <TabsTrigger value="images">Images ({images.length})</TabsTrigger>
          <TabsTrigger value="volumes">Volumes ({volumes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="containers"><DataTable columns={containerCols} initialSort="name" server={{ queryKey: ["docker", "containers"], fetch: api.docker.containersList }} /></TabsContent>
        <TabsContent value="images"><DataTable columns={imageCols} initialSort="repo" server={{ queryKey: ["docker", "images"], fetch: api.docker.imagesList }} /></TabsContent>
        <TabsContent value="volumes"><DataTable columns={volumeCols} initialSort="name" server={{ queryKey: ["docker", "volumes"], fetch: api.docker.volumesList }} /></TabsContent>
      </Tabs>

      <DetailDrawer
        open={!!logsFor}
        onOpenChange={(o) => !o && setLogsFor(null)}
        title={logsFor ? <span className="font-mono">{logsFor.name}</span> : ""}
        description={logsFor ? `${logsFor.image} · ${logsFor.status}` : ""}
        tabs={[
          { id: "logs", label: "Logs", content: logsFor ? <MockLogs name={logsFor.name} lines={120} /> : null },
          { id: "metrics", label: "Metrics", content: <MockMetrics /> },
          { id: "env", label: "Environment", content: <MockEnv keys={["PATH", "HOME", "LANG", "OLLAMA_HOST", "OLLAMA_MODELS", "CUDA_VISIBLE_DEVICES"]} /> },
        ]}
      />
    </div>
  );
}
