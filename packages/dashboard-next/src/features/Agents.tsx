import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  ExternalLink,
  FileText,
  FolderTree,
  Pause,
  PlayCircle,
  Power,
  RotateCw,
  Search,
  Upload,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { CodeBlock } from "@/components/CodeBlock";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/skeletons";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, uploadAgentFile } from "@/lib/api/client";
import { useT } from "@/hooks/useT";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import type { Agent, AgentHealth, AgentRunState } from "@/mocks/types";

const STATE_TONE: Record<AgentRunState, string> = {
  running: "bg-[var(--success)]",
  idle: "bg-[var(--muted-foreground)]",
  stopped: "bg-muted-foreground/50",
  error: "bg-[var(--destructive)]",
};

const HEALTH_LABEL: Record<AgentHealth, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
};

const HEALTH_TONE: Record<AgentHealth, string> = {
  healthy: "text-[var(--success)] border-[var(--success)]/30 bg-[var(--success)]/10",
  degraded: "text-[var(--warning)] border-[var(--warning)]/30 bg-[var(--warning)]/10",
  down: "text-[var(--destructive)] border-[var(--destructive)]/30 bg-[var(--destructive)]/10",
};

function formatUptime(sec: number) {
  if (!sec) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-xs mt-0.5 truncate">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspect dialog — renders real HermesProfile config + file upload for admins
// ---------------------------------------------------------------------------

/** Profile fields rendered as YAML-like config block in the dialog. */
function profileYaml(agent: Agent): string {
  const lines: string[] = [
    `profile: ${agent.slug}`,
    `model: ${agent.model}`,
    `provider: ${agent.modelProvider}`,
    `hermes_url: ${agent.hermesUrl}`,
    `version: ${agent.version}`,
    `state: ${agent.state}`,
    `health: ${agent.health}`,
  ];
  if (agent.description && !agent.description.startsWith("Hermes profile:")) {
    lines.push(`description: "${agent.description}"`);
  }
  return lines.join("\n");
}

function InspectorBody({ agent, isAdmin }: { agent: Agent; isAdmin: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFile, setActiveFile] = useState<string>("profile");

  // Files list — agent.files from registry (may be empty); always include the profile config tab.
  const hasDiskFiles = agent.files.length > 0;
  const activeContent =
    activeFile === "profile"
      ? profileYaml(agent)
      : (agent.files.find((f) => f.path === activeFile)?.content ?? "");
  const activeLanguage =
    activeFile === "profile"
      ? "yaml"
      : (agent.files.find((f) => f.path === activeFile)?.language ?? "text");

  const uploadMutation = useMutation({
    mutationFn: async ({ filename, content }: { filename: string; content: string }) => {
      return uploadAgentFile({ data: { slug: agent.slug, filename, content } });
    },
    onSuccess: (_, vars) => {
      toast.success("File uploaded", {
        description: `${vars.filename} written to ${agent.slug} profile directory.`,
      });
    },
    onError: (err) => {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content !== "string") return;
      uploadMutation.mutate({ filename: file.name, content });
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-uploaded if needed
    e.target.value = "";
  }

  return (
    <div className="grid gap-3 md:grid-cols-[200px_1fr]">
      <div className="space-y-1">
        {/* Always show the profile config tab */}
        <button
          onClick={() => setActiveFile("profile")}
          className={cn(
            "w-full text-left rounded px-2 py-1.5 text-xs flex items-center gap-2 hover:bg-muted/50 font-mono",
            activeFile === "profile" && "bg-accent text-accent-foreground",
          )}
        >
          <FileText className="size-3 text-muted-foreground" />
          <span className="truncate">profile.yaml</span>
        </button>

        {/* Disk files from the profile home directory (if any) */}
        {hasDiskFiles &&
          agent.files.map((f) => (
            <button
              key={f.path}
              onClick={() => setActiveFile(f.path)}
              className={cn(
                "w-full text-left rounded px-2 py-1.5 text-xs flex items-center gap-2 hover:bg-muted/50 font-mono",
                activeFile === f.path && "bg-accent text-accent-foreground",
              )}
            >
              <FileText className="size-3 text-muted-foreground" />
              <span className="truncate">{f.path}</span>
            </button>
          ))}

        <div className="pt-3 mt-3 border-t space-y-1.5 text-xs">
          <Badge variant="secondary" className="font-mono">
            {agent.model}
          </Badge>
          <p className="text-muted-foreground text-[11px]">
            v{agent.version} · {agent.slug}
          </p>
        </div>

        {/* File upload — admin only, scoped to this profile's home directory */}
        {isAdmin && (
          <div className="pt-2 mt-2 border-t">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              aria-label="Upload file to agent profile directory"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="size-3 mr-1.5" />
              {uploadMutation.isPending ? "Uploading…" : "Upload file"}
            </Button>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <CodeBlock
          language={activeLanguage}
          code={activeContent}
          className="h-[420px] overflow-auto"
        />
      </div>
    </div>
  );
}

export function AgentsPage() {
  const t = useT();
  const { user } = useAuth();
  const {
    data: agents = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: ["agents"], queryFn: api.agents });
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | AgentRunState>("all");
  const [inspect, setInspect] = useState<Agent | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return agents.filter((a) => {
      if (stateFilter !== "all" && a.state !== stateFilter) return false;
      if (!needle) return true;
      return [a.name, a.slug, a.model, a.description].some((x) => x.toLowerCase().includes(needle));
    });
  }, [agents, q, stateFilter]);

  const counts = useMemo(
    () => ({
      all: agents.length,
      running: agents.filter((a) => a.state === "running").length,
      idle: agents.filter((a) => a.state === "idle").length,
      stopped: agents.filter((a) => a.state === "stopped").length,
      error: agents.filter((a) => a.state === "error").length,
    }),
    [agents],
  );

  const handleAction = (action: string, a: Agent) => {
    if (!user?.is_admin) {
      toast.error("Admin only", { description: "You need admin role to control agents." });
      return;
    }
    toast.success(`${action} queued`, { description: `${a.name} (${a.slug})` });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Bot className="size-5" />}
        title={t.nav.agents}
        description="Hermes agent fleet — live status, model, health and direct links to each agent's Hermes UI."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, model or slug…"
            className="pl-8 h-9"
          />
        </div>
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          {(["all", "running", "idle", "stopped", "error"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              className={cn(
                "rounded-md border px-2.5 h-8 text-xs capitalize transition-colors",
                stateFilter === s
                  ? "bg-accent text-accent-foreground border-accent"
                  : "hover:bg-muted/50",
              )}
            >
              {s} <span className="text-muted-foreground ml-1 tabular-nums">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} lines={4} />
          ))}
        </div>
      ) : isError ? (
        <Card className="elev-1">
          <EmptyState
            icon={<AlertTriangle className="size-8 text-[var(--destructive)]" />}
            title="Failed to load agents"
            description="Could not read the Hermes profiles registry. Check that the registry file exists and is readable."
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="elev-1">
          <EmptyState
            icon={<Bot className="size-8" />}
            title="No agents match"
            description={
              agents.length === 0
                ? "No Hermes agents are registered yet."
                : "Try clearing your filters."
            }
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQ("");
                  setStateFilter("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <Card
              key={a.slug}
              className="elev-1 p-4 flex flex-col gap-3 group hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <div className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center">
                    <Bot className="size-5" />
                  </div>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-background",
                      STATE_TONE[a.state],
                      a.state === "running" && "animate-pulse motion-reduce:animate-none",
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{a.name}</h3>
                    <span className="text-[10px] text-muted-foreground font-mono truncate">
                      {a.slug}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {a.description}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wide rounded-full border px-2 py-0.5 shrink-0",
                    HEALTH_TONE[a.health],
                  )}
                >
                  {HEALTH_LABEL[a.health]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <Cell
                  label="Model"
                  value={
                    <span className="font-mono truncate block" title={a.model}>
                      {a.model}
                    </span>
                  }
                />
                <Cell
                  label="Provider"
                  value={<span className="capitalize">{a.modelProvider}</span>}
                />
                <Cell label="Uptime" value={formatUptime(a.uptimeSec)} />
                <Cell label="Queue" value={<span className="tabular-nums">{a.queueDepth}</span>} />
                <Cell
                  label="Req/min"
                  value={<span className="tabular-nums">{a.requestsPerMin}</span>}
                />
                <Cell
                  label="Error rate"
                  value={
                    <span
                      className={cn(
                        "tabular-nums",
                        a.errorRatePct >= 5
                          ? "text-[var(--destructive)]"
                          : a.errorRatePct >= 1
                            ? "text-[var(--warning)]"
                            : "",
                      )}
                    >
                      {a.errorRatePct.toFixed(1)}%
                    </span>
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Activity className="size-3" /> p95 {a.p95LatencyMs}ms
                </span>
                <span>
                  v{a.version} · {relativeTime(a.lastActivity)}
                </span>
              </div>

              <div className="flex items-center gap-1 pt-1 border-t -mx-4 -mb-4 px-3 py-2 bg-muted/20 rounded-b-lg">
                <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                  <a href={a.hermesUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5 mr-1" /> Hermes UI
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setInspect(a)}
                >
                  <FileText className="size-3.5 mr-1" /> Inspect
                </Button>
                <div className="flex-1" />
                {a.state === "running" || a.state === "idle" ? (
                  <>
                    <Button
                      size="icon"
                      variant="outline-warning"
                      className="size-7"
                      title="Restart"
                      onClick={() => handleAction("Restart", a)}
                    >
                      <RotateCw className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-7"
                      title="Pause"
                      onClick={() => handleAction("Pause", a)}
                    >
                      <Pause className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline-destructive"
                      className="size-7"
                      title="Stop"
                      onClick={() => handleAction("Stop", a)}
                    >
                      <Power className="size-3.5" />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="icon"
                    variant="outline-success"
                    className="size-7"
                    title="Start"
                    onClick={() => handleAction("Start", a)}
                  >
                    <PlayCircle className="size-3.5" />
                  </Button>
                )}
              </div>

              {a.state === "error" && (
                <div className="flex items-start gap-2 rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-2.5 py-1.5 text-[11px] text-[var(--destructive)]">
                  <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                  <span>
                    Agent crashed — check{" "}
                    <Link to="/audit" className="underline">
                      audit log
                    </Link>{" "}
                    for details.
                  </span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!inspect} onOpenChange={(o) => !o && setInspect(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="size-4" />
              {inspect?.name}{" "}
              <span className="text-xs text-muted-foreground font-mono">{inspect?.slug}</span>
            </DialogTitle>
          </DialogHeader>
          {inspect && <InspectorBody agent={inspect} isAdmin={!!user?.is_admin} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
