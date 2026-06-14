import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FileCode, Lock, Unlock, Copy, ShieldCheck, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { readAdminEnv, unlockAdminEnv, updateAdminEnv } from "./rpc";

/**
 * Known allowlisted env paths. The server enforces an allowlist
 * (`/opt/cortexos/.secrets/`, `/opt/cortexos/stacks/`) and exposes no
 * directory-listing fn, so the picker is seeded from a known list (WP-40).
 */
const KNOWN_PATHS: readonly string[] = [
  "/opt/cortexos/.secrets/dashboard.env",
  "/opt/cortexos/.secrets/cortexos.env",
];

function remainingSeconds(expiresAt: number | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}

export function AdminEnvPage() {
  const [selected, setSelected] = useState(0);
  const path = KNOWN_PATHS[selected] ?? KNOWN_PATHS[0];

  const [unlockOpen, setUnlockOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const query = useQuery({
    queryKey: ["envFiles", path],
    queryFn: () => readAdminEnv(path),
    // Once a reveal grant is live, keep the cleartext fresh until it expires.
    refetchInterval: (q) => {
      const { data } = q.state;
      if (data?.revealed && data.revealExpiresAt && data.revealExpiresAt > Date.now()) {
        return 30_000;
      }
      return false;
    },
    retry: false,
  });

  const { data } = query;
  const revealed = !!data?.revealed && remainingSeconds(data.revealExpiresAt) > 0;

  // Latest-ref pattern: the per-second timer below must retrigger only on
  // `now`, but it needs the current revealed state, expiry, and refetch fn.
  const revealedRef = useRef(revealed);
  const expiresAtRef = useRef(data?.revealExpiresAt ?? null);
  const refetchRef = useRef(query.refetch);
  revealedRef.current = revealed;
  expiresAtRef.current = data?.revealExpiresAt ?? null;
  refetchRef.current = query.refetch;

  // Tick the countdown each second while a grant is live; refetch when it lapses
  // so cleartext is cleared from the client view.
  useEffect(() => {
    if (!revealed) {
      return () => {};
    }
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [revealed]);

  useEffect(() => {
    if (revealedRef.current && remainingSeconds(expiresAtRef.current) === 0) {
      refetchRef.current().catch(() => {});
    }
  }, [now]);

  // Recomputed every render — the per-second `setNow` tick keeps it current.
  const liveRemaining = remainingSeconds(data?.revealExpiresAt ?? null);

  const doUnlock = async () => {
    const pw = password;
    // Never keep the password in state beyond the submission.
    setPassword("");
    setUnlocking(true);
    try {
      await unlockAdminEnv(pw);
      setUnlockOpen(false);
      toast.success("Reveal unlocked for 10 minutes");
      await query.refetch();
    } catch {
      toast.error("Incorrect password or permission denied");
    } finally {
      setUnlocking(false);
    }
  };

  const copy = (key: string, value: string) => {
    navigator.clipboard?.writeText(value)?.catch(() => {});
    toast.success(`Copied ${key}`);
  };

  const qc = useQueryClient();
  const [editEntry, setEditEntry] = useState<{ key: string; value: string } | null>(null);
  const saveMut = useMutation({
    mutationFn: (vars: { key: string; value: string }) =>
      updateAdminEnv(path, vars.key, vars.value),
    onSuccess: (_d, vars) => {
      toast.success(`Updated ${vars.key}`);
      setEditEntry(null);
      qc.invalidateQueries({ queryKey: ["envFiles", path] }).catch(() => {});
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update value"),
  });

  let entriesPanel;
  if (query.isError) {
    entriesPanel = (
      <EmptyState
        icon={<FileCode className="size-8" />}
        title="Env browser unavailable"
        description="This file is not accessible or the env browser requires server-side configuration."
      />
    );
  } else if (query.isLoading) {
    entriesPanel = <EmptyState title="Loading…" />;
  } else if (data && data.entries.length > 0) {
    entriesPanel = (
      <>
        <div className="flex items-center justify-between mb-3">
          <code className="text-xs text-muted-foreground">{data.path}</code>
          <span className="text-xs text-muted-foreground">{data.entries.length} keys</span>
        </div>
        <div className="space-y-2">
          {data.entries.map((entry) => (
            <div key={entry.key} className="grid grid-cols-[200px_1fr_auto] gap-2 items-center">
              <code className="text-xs font-semibold">{entry.key}</code>
              <Input value={entry.value} readOnly className="h-8 font-mono text-xs" />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!revealed}
                  onClick={() => copy(entry.key, entry.value)}
                  title={revealed ? "Copy value" : "Unlock to copy cleartext"}
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!revealed}
                  onClick={() => setEditEntry({ key: entry.key, value: entry.value })}
                  title={revealed ? "Edit value" : "Unlock to edit"}
                  aria-label={`Edit ${entry.key}`}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  } else {
    entriesPanel = (
      <EmptyState
        icon={<FileCode className="size-8" />}
        title="No entries"
        description="This env file has no readable keys."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Env Browser"
        description="Inspect and rotate environment secrets for managed services."
        actions={
          revealed ? (
            <Badge variant="secondary" className="gap-1.5">
              <ShieldCheck className="size-3.5" />
              Reveal active · expires in {Math.ceil(liveRemaining / 60)}m
            </Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setUnlockOpen(true)}>
              <Lock className="size-4 mr-1" />
              Unlock to reveal
            </Button>
          )
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <Card className="p-2 h-fit">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pb-2">
            Env files
          </div>
          {KNOWN_PATHS.map((p, i) => (
            <button
              key={p}
              onClick={() => setSelected(i)}
              className={`w-full text-left rounded-md px-2 py-1.5 flex items-center gap-2 text-sm transition-colors ${i === selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"}`}
            >
              <FileCode className="size-3.5 shrink-0" />
              <span className="truncate font-mono text-xs">{p.split("/").pop()}</span>
            </button>
          ))}
        </Card>
        <Card className="p-4">{entriesPanel}</Card>
      </div>

      <Dialog
        open={unlockOpen}
        onOpenChange={(o) => {
          setUnlockOpen(o);
          if (!o) setPassword("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="size-4" />
              Unlock secret reveal
            </DialogTitle>
            <DialogDescription>
              Re-enter your password to reveal cleartext secrets for 10 minutes. Your password is
              verified server-side and never stored.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Password</Label>
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && password && !unlocking) doUnlock().catch(() => {});
              }}
              className="h-9"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setUnlockOpen(false);
                setPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                doUnlock().catch(() => {});
              }}
              disabled={!password || unlocking}
            >
              {unlocking ? "Verifying…" : "Unlock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4" />
              Edit {editEntry?.key}
            </DialogTitle>
            <DialogDescription>
              Writes <code className="font-mono">{editEntry?.key}</code> back to{" "}
              <code className="font-mono">{path}</code>. Changing a value here can break the
              services that read it — they may need a restart to pick it up.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Value</Label>
            <Input
              autoFocus
              value={editEntry?.value ?? ""}
              onChange={(e) => setEditEntry((p) => (p ? { ...p, value: e.target.value } : p))}
              className="h-9 font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditEntry(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={saveMut.isPending}
              onClick={() => editEntry && saveMut.mutate(editEntry)}
            >
              {saveMut.isPending ? "Saving…" : "Save value"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
