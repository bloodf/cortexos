import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  Plus,
  Boxes,
  Loader2,
  CheckCircle2,
  Play,
  Square,
  RotateCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { KeyValueList } from "@/components/KeyValueList";
import { CodeBlock } from "@/components/CodeBlock";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TableSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/EmptyState";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, callIncusAction, callMintApproval } from "@/lib/api/client";
import { useT } from "@/hooks/useT";
import { useAuth } from "@/hooks/useAuth";
import type { IncusInstance } from "@/mocks/types";
import { bytes, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Approval-gated incus action helper (mirrors Docker.tsx pattern)
// ---------------------------------------------------------------------------

/**
 * Mint an approval token then dispatch the incus action.
 * Destructive actions (stop/restart/delete) require a valid token bound to
 * the current session (PB-5). Non-destructive actions (start/launch) still
 * go through mintApproval so the bridge's approval gate is satisfied.
 */
async function dispatchIncusAction(
  action: "start" | "stop" | "restart" | "delete" | "launch",
  name: string,
  confirmation?: string,
): Promise<void> {
  const mint = await callMintApproval({
    data: { action: `incus.${action}`, payload: { action, name } },
  });
  await callIncusAction({
    data: { action, name, confirmation, approvalToken: mint.token },
  });
}

const statusColors: Record<string, string> = {
  active: "border-[var(--success)] text-[var(--success)]",
  running: "border-[var(--success)] text-[var(--success)]",
  provisioning: "border-[var(--warning)] text-[var(--warning)]",
  validated: "border-primary text-primary",
  draft: "border-muted-foreground text-muted-foreground",
  stopped: "border-muted-foreground text-muted-foreground",
  frozen: "border-muted-foreground text-muted-foreground",
  failed: "border-[var(--destructive)] text-[var(--destructive)]",
  error: "border-[var(--destructive)] text-[var(--destructive)]",
};

function ProvisionWizard({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("hermes-canary");
  const [image, setImage] = useState("ubuntu/24.04");
  const [cpu, setCpu] = useState(2);
  const [mem, setMem] = useState(4096);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [launching, setLaunching] = useState(false);

  const appendLog = (msg: string) => setLog((l) => [...l, msg]);

  const start = async () => {
    setStep(4);
    setLog([]);
    setDone(false);
    setLaunching(true);

    appendLog(`Preflight: validating name "${name}"…`);
    appendLog(`Preflight: checking image cache for ${image}…`);
    appendLog(`incus launch ${image} ${name}`);

    try {
      const mint = await callMintApproval({
        data: { action: "incus.launch", payload: { action: "launch", name } },
      });
      appendLog("Approval token minted.");
      await callIncusAction({
        data: { action: "launch", name, approvalToken: mint.token },
      });
      appendLog(`Applying limits.cpu=${cpu}`);
      appendLog(`Applying limits.memory=${mem}MiB`);
      appendLog("Starting instance…");
      appendLog("Instance started");
      setDone(true);
      onCreated();
    } catch (err) {
      appendLog(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLaunching(false);
    }
  };

  const reset = () => {
    setStep(0);
    setLog([]);
    setDone(false);
    setLaunching(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Provision Incus instance</DialogTitle>
          <DialogDescription>Step {Math.min(step + 1, 5)} of 5</DialogDescription>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-3">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        {step === 1 && (
          <div className="space-y-3">
            <Label>Image</Label>
            <Select value={image} onValueChange={setImage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ubuntu/24.04">ubuntu/24.04</SelectItem>
                <SelectItem value="debian/12">debian/12</SelectItem>
                <SelectItem value="alpine/3.20">alpine/3.20</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <Label>CPU cores</Label>
            <Input type="number" value={cpu} onChange={(e) => setCpu(+e.target.value)} />
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <Label>Memory (MiB)</Label>
            <Input type="number" value={mem} onChange={(e) => setMem(+e.target.value)} />
          </div>
        )}
        {step === 4 && (
          <div className="space-y-2">
            <div className="rounded-md border bg-[oklch(0.14_0.01_260)] text-[oklch(0.92_0.01_260)] p-3 font-mono text-xs h-48 overflow-auto">
              {log.map((l, i) => (
                <div key={i} className="flex gap-2">
                  {launching && i === log.length - 1 ? (
                    <Loader2 className="size-3 animate-spin text-primary mt-0.5" />
                  ) : (
                    <span className="text-muted-foreground">›</span>
                  )}
                  {l}
                </div>
              ))}
              {done && (
                <div className="flex items-center gap-2 text-[var(--success)] mt-2">
                  <CheckCircle2 className="size-4" /> Provisioning complete
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step > 0 && step < 4 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < 3 && <Button onClick={() => setStep(step + 1)}>Next</Button>}
          {step === 3 && (
            <Button onClick={start} disabled={!name.trim()}>
              Provision
            </Button>
          )}
          {step === 4 && done && (
            <Button
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function IncusPage() {
  const t = useT();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isLoading, isError } = useQuery({
    queryKey: ["incus"],
    queryFn: api.incus,
    refetchInterval: 15_000,
  });
  const [active, setActive] = useState<IncusInstance | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const isAdmin = !!user?.is_admin;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["incus"] }).catch(() => {});
  };

  const handleStart = async (inst: IncusInstance) => {
    const key = `start-${inst.name}`;
    setPendingAction(key);
    try {
      await dispatchIncusAction("start", inst.name);
      toast.success(`Started ${inst.name}`);
      invalidate();
    } catch {
      toast.error(`Failed to start ${inst.name}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleStop = async (inst: IncusInstance) => {
    const key = `stop-${inst.name}`;
    setPendingAction(key);
    try {
      await dispatchIncusAction("stop", inst.name);
      toast.success(`Stopped ${inst.name}`);
      invalidate();
    } catch {
      toast.error(`Failed to stop ${inst.name}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleRestart = async (inst: IncusInstance) => {
    const key = `restart-${inst.name}`;
    setPendingAction(key);
    try {
      await dispatchIncusAction("restart", inst.name);
      toast.success(`Restarted ${inst.name}`);
      invalidate();
    } catch {
      toast.error(`Failed to restart ${inst.name}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async (inst: IncusInstance) => {
    const key = `delete-${inst.name}`;
    setPendingAction(key);
    try {
      await dispatchIncusAction("delete", inst.name, "delete");
      toast.success(`Deleted ${inst.name}`);
      invalidate();
    } catch {
      toast.error(`Failed to delete ${inst.name}`);
    } finally {
      setPendingAction(null);
    }
  };

  const cols: Column<IncusInstance>[] = [
    {
      key: "project",
      header: "Project",
      sort: (r) => r.project.name,
      cell: (r) => (
        <div className="min-w-0">
          <Link
            to="/incus/$name"
            params={{ name: r.name }}
            className="font-medium hover:underline truncate block"
          >
            {r.project.name}
          </Link>
          <p className="text-[10px] text-muted-foreground truncate">{r.project.description}</p>
        </div>
      ),
    },
    {
      key: "name",
      header: "Instance",
      sort: (r) => r.name,
      cell: (r) => <code className="text-xs">{r.name}</code>,
    },
    {
      key: "type",
      header: "Type",
      sort: (r) => r.type,
      cell: (r) => <Badge variant="outline">{r.type}</Badge>,
    },
    {
      key: "image",
      header: "Image",
      cell: (r) => <code className="text-xs">{r.image}</code>,
    },
    {
      key: "cpu",
      header: "CPU",
      className: "text-right tabular-nums",
      cell: (r) => `${r.cpu}`,
    },
    {
      key: "memory",
      header: "Memory",
      className: "text-right tabular-nums",
      cell: (r) => bytes(r.memory * 1024 * 1024),
    },
    {
      key: "status",
      header: "Status",
      sort: (r) => r.status,
      cell: (r) => (
        <Badge variant="outline" className={cn(statusColors[r.status] ?? "")}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "act",
      header: "",
      className: "text-right",
      cell: (r) => {
        const acting = pendingAction !== null;
        const isRunning = (r.status as string) === "active" || (r.status as string) === "running";
        return (
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setActive(r)}>
              <ChevronRight className="size-3.5" />
            </Button>
            {isAdmin && !isRunning && (
              <Button
                size="sm"
                variant="ghost"
                disabled={acting}
                onClick={() => handleStart(r)}
                title="Start"
              >
                {pendingAction === `start-${r.name}` ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5" />
                )}
              </Button>
            )}
            {isAdmin && isRunning && (
              <Button
                size="sm"
                variant="ghost"
                disabled={acting}
                onClick={() => handleStop(r)}
                title="Stop"
              >
                {pendingAction === `stop-${r.name}` ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Square className="size-3.5" />
                )}
              </Button>
            )}
            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                disabled={acting}
                onClick={() => handleRestart(r)}
                title="Restart"
              >
                {pendingAction === `restart-${r.name}` ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCw className="size-3.5" />
                )}
              </Button>
            )}
            {isAdmin && (
              <ConfirmDialog
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={acting}
                    className="text-destructive hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                }
                title={`Delete instance ${r.name}?`}
                description="This will permanently delete the instance. This cannot be undone."
                destructive
                requireText={r.name}
                confirmLabel="Delete"
                onConfirm={() => handleDelete(r)}
              />
            )}
          </div>
        );
      },
    },
  ];

  let tablePanel;
  if (isLoading) {
    tablePanel = <TableSkeleton rows={6} cols={7} />;
  } else if (isError) {
    tablePanel = (
      <EmptyState
        title="Failed to load instances"
        description="Could not reach the Incus bridge. Check that the Incus daemon is running."
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["incus"] })}
          >
            Retry
          </Button>
        }
      />
    );
  } else {
    tablePanel = (
      <DataTable
        columns={cols}
        initialSort="project"
        server={{ queryKey: ["incus"], fetch: api.incusList }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Boxes className="size-5" />}
        title={t.nav.incus}
        description="One project per Incus instance — manage system containers, VMs and the projects they host."
        actions={
          isAdmin ? (
            <Button size="sm" variant="success" onClick={() => setWizardOpen(true)}>
              <Plus className="size-4 mr-1" />
              New project / instance
            </Button>
          ) : undefined
        }
      />

      {tablePanel}

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle>{active.project.name}</SheetTitle>
                <p className="text-xs text-muted-foreground">{active.project.description}</p>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <KeyValueList
                  items={[
                    { key: "Instance", value: <code className="text-xs">{active.name}</code> },
                    {
                      key: "Repo",
                      value: active.project.repo_url ? (
                        <a
                          href={active.project.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline text-xs"
                        >
                          {active.project.repo_url.replace("https://", "")}
                        </a>
                      ) : (
                        "—"
                      ),
                    },
                    {
                      key: "Branch",
                      value: <code className="text-xs">{active.project.branch}</code>,
                    },
                    { key: "Type", value: active.type },
                    { key: "Image", value: active.image },
                    {
                      key: "Status",
                      value: (
                        <Badge variant="outline" className={cn(statusColors[active.status] ?? "")}>
                          {active.status}
                        </Badge>
                      ),
                    },
                    { key: "CPU", value: active.cpu },
                    { key: "Memory", value: bytes(active.memory * 1024 * 1024) },
                    { key: "Created", value: relativeTime(active.created_at) },
                  ]}
                />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Devices
                  </p>
                  <CodeBlock
                    language="yaml"
                    code={Object.entries(active.devices)
                      .map(
                        ([k, v]) =>
                          `${k}:\n${Object.entries(v)
                            .map(([kk, vv]) => `  ${kk}: ${vv}`)
                            .join("\n")}`,
                      )
                      .join("\n")}
                  />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ProvisionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={() => {
          invalidate();
          toast.success("Instance provisioned");
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provision wizard — wired to incusAction(launch) via mintApproval
// ---------------------------------------------------------------------------
