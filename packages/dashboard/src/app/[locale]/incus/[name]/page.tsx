"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Boxes, Play, Square, RotateCw, Trash2, Terminal, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { KeyValueList } from "@/components/sys-pilot/KeyValueList";
import { CodeBlock } from "@/components/sys-pilot/CodeBlock";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { relativeTime } from "@/lib/sys-pilot/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface InstanceDetail {
  id: number;
  name: string;
  slug: string | null;
  status: string;
  config: Record<string, unknown>;
  last_validation: Record<string, unknown> | null;
  last_request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  live_status: string | null;
}

const statusColor = (s: string | null | undefined): string => {
  switch ((s ?? "").toLowerCase()) {
    case "running":
    case "active":
      return "border-[var(--success)] text-[var(--success)]";
    case "provisioning":
      return "border-[var(--warning)] text-[var(--warning)]";
    case "validated":
      return "border-primary text-primary";
    case "failed":
    case "error":
      return "border-[var(--destructive)] text-[var(--destructive)]";
    default:
      return "border-muted-foreground text-muted-foreground";
  }
};

async function fetchDetail(name: string): Promise<InstanceDetail | null> {
  const res = await fetch(`/api/incus/instances/${encodeURIComponent(name)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load instance (${res.status})`);
  }
  const body = await res.json();
  return body.data as InstanceDetail;
}

async function fetchLiveInfo(name: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`/api/incus/${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return (body.data as Record<string, unknown>) ?? null;
}

export default function IncusDetailPage() {
  const params = useParams<{ name: string }>();
  const name = decodeURIComponent(params?.name ?? "");
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ["incus", name],
    queryFn: () => fetchDetail(name),
    enabled: !!name,
  });

  const { data: liveInfo } = useQuery({
    queryKey: ["incus", name, "live"],
    queryFn: () => fetchLiveInfo(name),
    enabled: !!name,
    refetchInterval: 5000,
  });

  const [pending, setPending] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["incus", name] });
    qc.invalidateQueries({ queryKey: ["incus"] });
  };

  const runAction = async (action: "start" | "stop" | "restart" | "delete") => {
    setPending(action);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (action === "delete") headers["x-incus-delete-confirm"] = "true";
      const res = await fetch("/api/incus/actions", {
        method: "POST",
        headers,
        body: JSON.stringify({ action, name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `${action} failed`);
      toast.success(`${action} succeeded`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setPending(null);
    }
  };

  const live = (liveInfo?.status as string | undefined) ?? detail?.live_status ?? null;
  const isRunning = (live ?? "").toLowerCase() === "running";

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Boxes className="size-5" />}
        title={name || "Instance"}
        description="Incus instance detail."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/incus"
              className="inline-flex h-7 items-center rounded-md px-2.5 text-[0.8rem] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-3.5 mr-1" />Back
            </Link>
            {user?.is_admin && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!pending || isRunning}
                  onClick={() => runAction("start")}
                >
                  {pending === "start" ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Play className="size-4 mr-1" />}
                  Start
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!pending || !isRunning}
                  onClick={() => runAction("stop")}
                >
                  {pending === "stop" ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Square className="size-4 mr-1" />}
                  Stop
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!pending}
                  onClick={() => runAction("restart")}
                >
                  {pending === "restart" ? <Loader2 className="size-4 mr-1 animate-spin" /> : <RotateCw className="size-4 mr-1" />}
                  Restart
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="text-[var(--destructive)]" disabled={!!pending}>
                      <Trash2 className="size-4 mr-1" />Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This force-deletes the Incus instance and cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-[var(--destructive)] text-white hover:bg-[var(--destructive)]/90"
                        onClick={() => runAction("delete")}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-lg border bg-card p-8 text-center text-[var(--destructive)]">
          {error instanceof Error ? error.message : "Failed to load instance"}
        </div>
      ) : !detail ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Instance not found.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-lg border bg-card p-5">
            <KeyValueList
              items={[
                { key: "Name", value: detail.name },
                { key: "Slug", value: detail.slug ?? "—" },
                {
                  key: "Saved Status",
                  value: <Badge variant="outline" className={cn(statusColor(detail.status))}>{detail.status}</Badge>,
                },
                {
                  key: "Live Status",
                  value: live
                    ? <Badge variant="outline" className={cn(statusColor(live))}>{live}</Badge>
                    : <span className="text-muted-foreground">unknown</span>,
                },
                { key: "Created By", value: detail.created_by ?? "—" },
                { key: "Created", value: relativeTime(detail.created_at) },
                { key: "Updated", value: relativeTime(detail.updated_at) },
                { key: "Last Request", value: detail.last_request_id ?? "—" },
              ]}
            />
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Config</p>
            <CodeBlock
              language="json"
              code={JSON.stringify(detail.config ?? {}, null, 2)}
            />
          </div>

          {detail.last_validation && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Last Validation</p>
              <CodeBlock
                language="json"
                code={JSON.stringify(detail.last_validation, null, 2)}
              />
            </div>
          )}

          {liveInfo && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Live Info (incus info)</p>
              <CodeBlock
                language="json"
                code={JSON.stringify(liveInfo, null, 2)}
              />
            </div>
          )}

          {user?.is_admin && <ShellPanel name={name} disabled={!isRunning} />}
        </div>
      )}
    </div>
  );
}

function ShellPanel({ name, disabled }: { name: string; disabled: boolean }) {
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    const cmd = command.trim();
    if (!cmd) return;
    setRunning(true);
    setOutput(null);
    try {
      const res = await fetch(`/api/incus/${encodeURIComponent(name)}/shell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `shell failed (${res.status})`);
      const combined = [body.stdout, body.stderr].filter(Boolean).join("\n");
      setOutput(combined || "(no output)");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "shell failed";
      setOutput(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Terminal className="size-4" />Shell
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !running) run(); }}
          placeholder={disabled ? "Instance must be running to exec" : "uname -a"}
          className="font-mono"
          disabled={disabled || running}
        />
        <Button onClick={run} disabled={disabled || running || !command.trim()}>
          {running ? <Loader2 className="size-4 animate-spin" /> : "Run"}
        </Button>
      </div>
      {output !== null && <CodeBlock language="bash" code={output} />}
    </div>
  );
}
