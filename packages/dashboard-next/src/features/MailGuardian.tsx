import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Mail,
  Shield,
  AlertTriangle,
  Flag,
  CheckCheck,
  X,
  Settings,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  api,
  callFlagReview,
  callApproveReview,
  callBatchDecision,
  callListMailAccounts,
  callCreateMailAccount,
  callUpdateMailAccount,
  callDeleteMailAccount,
} from "@/lib/api/client";
import type { ServerMailAccount } from "@/lib/api/client";
import { useT } from "@/hooks/useT";
import { useAuth } from "@/hooks/useAuth";
import { csrfHeaders } from "@/lib/csrf";
import type { MailReview } from "@/mocks/types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Risk colour helpers
// ---------------------------------------------------------------------------

const riskColor = {
  low: "border-[var(--success)] text-[var(--success)]",
  medium: "border-[var(--warning)] text-[var(--warning)]",
  high: "border-[var(--destructive)] text-[var(--destructive)]",
} as const;

// ---------------------------------------------------------------------------
// Reviews pane — two-pane list + detail
// ---------------------------------------------------------------------------

function ReviewsPane() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;

  const {
    data: mails = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: ["mail"], queryFn: api.mail, refetchInterval: 30_000 });

  const [sel, setSel] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);

  const active = mails.find((m) => m.id === sel) ?? mails[0] ?? null;

  const allIds = useMemo(() => mails.map((m) => m.id), [mails]);
  const allChecked = picked.size > 0 && picked.size === allIds.length;
  const someChecked = picked.size > 0 && !allChecked;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["mail"] });

  // Optimistic helper: update status in cache before server confirms.
  const optimisticStatus = (id: string, status: MailReview["status"]) => {
    qc.setQueryData<MailReview[]>(["mail"], (p) =>
      p?.map((m) => (m.id === id ? { ...m, status } : m)),
    );
  };

  const handleFlag = async (id: string) => {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) return;
    setActing(`flag-${id}`);
    optimisticStatus(id, "flagged");
    try {
      await callFlagReview({ data: { id: numId }, headers: csrfHeaders() });
      toast.success("Email flagged");
      invalidate().catch(() => {});
    } catch {
      toast.error("Failed to flag email");
      invalidate().catch(() => {}); // revert optimistic update
    } finally {
      setActing(null);
    }
  };

  const handleApprove = async (id: string) => {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) return;
    setActing(`approve-${id}`);
    optimisticStatus(id, "approved");
    try {
      await callApproveReview({ data: { id: numId }, headers: csrfHeaders() });
      toast.success("Email approved");
      invalidate().catch(() => {});
    } catch {
      toast.error("Failed to approve email");
      invalidate().catch(() => {});
    } finally {
      setActing(null);
    }
  };

  const handleBatch = async (action: "approve" | "flag") => {
    const ids = Array.from(picked)
      .map((id) => parseInt(id, 10))
      .filter((n) => !Number.isNaN(n));
    if (!ids.length) return;
    const status: MailReview["status"] = action === "approve" ? "approved" : "flagged";
    // Optimistic batch update
    qc.setQueryData<MailReview[]>(["mail"], (p) =>
      p?.map((m) => (picked.has(m.id) ? { ...m, status } : m)),
    );
    setPicked(new Set());
    try {
      await callBatchDecision({ data: { ids, action }, headers: csrfHeaders() });
      toast.success(
        `${ids.length} email${ids.length === 1 ? "" : "s"} ${action === "approve" ? "approved" : "flagged"}`,
      );
      invalidate().catch(() => {});
    } catch {
      toast.error(`Batch ${action} failed`);
      invalidate().catch(() => {});
    }
  };

  const togglePick = (id: string, checked: boolean) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setPicked(checked ? new Set(allIds) : new Set());
  };

  if (isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-[420px_1fr]">
        <Card className="elev-1 p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </Card>
        <Card className="elev-1 p-5 space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Failed to load mail reviews"
        description="Could not reach the mail guardian database. Check that the DB is accessible."
        action={
          <Button size="sm" variant="outline" onClick={invalidate}>
            <RefreshCw className="size-3.5 mr-1.5" />
            Retry
          </Button>
        }
      />
    );
  }

  if (mails.length === 0) {
    return (
      <EmptyState
        icon={<Mail className="size-8" />}
        title="No mail reviews"
        description="No emails have been queued for review yet. Configure an IMAP account in the Accounts tab."
      />
    );
  }

  let selectAllChecked: boolean | "indeterminate" = false;
  if (allChecked) {
    selectAllChecked = true;
  } else if (someChecked) {
    selectAllChecked = "indeterminate";
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[420px_1fr]">
      {/* Left pane — list */}
      <Card className="elev-1 overflow-hidden">
        {/* Batch toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
          <Checkbox
            checked={selectAllChecked}
            onCheckedChange={(v) => toggleAll(v === true)}
            aria-label="Select all"
          />
          {picked.size > 0 ? (
            <>
              <span className="text-xs text-muted-foreground">{picked.size} selected</span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  variant="success"
                  className="h-7"
                  disabled={!isAdmin}
                  onClick={() => handleBatch("approve")}
                >
                  <CheckCheck className="size-3.5 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7"
                  disabled={!isAdmin}
                  onClick={() => handleBatch("flag")}
                >
                  <Flag className="size-3.5 mr-1" />
                  Flag
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => setPicked(new Set())}
                  aria-label="Clear selection"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Select to batch-process</span>
          )}
        </div>

        <div className="divide-y max-h-[70vh] overflow-y-auto">
          {mails.map((m) => {
            const isPicked = picked.has(m.id);
            const isActive = active?.id === m.id;
            const isFlagging = acting === `flag-${m.id}`;
            const isApproving = acting === `approve-${m.id}`;
            return (
              <div
                key={m.id}
                className={cn(
                  "group flex items-start gap-2 px-3 py-2.5 hover:bg-muted/30",
                  isActive && "bg-accent/50",
                  isPicked && "bg-primary/5",
                )}
              >
                <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isPicked}
                    onCheckedChange={(v) => togglePick(m.id, v === true)}
                    aria-label={`Select ${m.subject}`}
                  />
                </div>
                <button onClick={() => setSel(m.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{m.from}</p>
                      <p className="text-sm truncate">{m.subject}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.snippet}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] uppercase shrink-0", riskColor[m.risk])}
                    >
                      {m.risk}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {relativeTime(m.received_at)} · {m.status}
                  </p>
                </button>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="outline-success"
                    className="h-7 w-7"
                    title="Approve"
                    disabled={!isAdmin || isApproving || isFlagging}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(m.id).catch(() => {});
                    }}
                  >
                    {isApproving ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Shield className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline-destructive"
                    className="h-7 w-7"
                    title="Flag"
                    disabled={!isAdmin || isApproving || isFlagging}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFlag(m.id).catch(() => {});
                    }}
                  >
                    {isFlagging ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Flag className="size-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Right pane — detail */}
      <Card className="elev-1 p-5 space-y-4">
        {active ? (
          <>
            <div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h2 className="text-lg font-semibold">{active.subject}</h2>
                <Badge variant="outline" className={cn(riskColor[active.risk])}>
                  {active.risk === "high" && <AlertTriangle className="size-3 mr-1" />}
                  {active.risk} risk
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                From <span className="font-mono">{active.from}</span> ·{" "}
                {relativeTime(active.received_at)}
              </p>
            </div>
            <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {active.body}
            </div>
            <div className="flex gap-2 pt-3 border-t">
              <Button
                variant="success"
                disabled={!isAdmin || acting === `approve-${active.id}`}
                onClick={() => {
                  handleApprove(active.id).catch(() => {});
                }}
              >
                {acting === `approve-${active.id}` ? (
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                ) : (
                  <Shield className="size-4 mr-1.5" />
                )}
                Approve
              </Button>
              <Button
                variant="destructive"
                disabled={!isAdmin || acting === `flag-${active.id}`}
                onClick={() => {
                  handleFlag(active.id).catch(() => {});
                }}
              >
                {acting === `flag-${active.id}` ? (
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                ) : (
                  <Flag className="size-4 mr-1.5" />
                )}
                Flag
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select an email.</p>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account form dialog (create / edit)
// ---------------------------------------------------------------------------

interface AccountFormValues {
  slug: string;
  address: string;
  host: string;
  port: string;
  secure: boolean;
  username: string;
  password: string;
  inbox: string;
  trashMailbox: string;
  reviewMailbox: string;
  enabled: boolean;
}

const emptyForm = (): AccountFormValues => ({
  slug: "",
  address: "",
  host: "",
  port: "993",
  secure: true,
  username: "",
  password: "",
  inbox: "INBOX",
  trashMailbox: "",
  reviewMailbox: "INBOX.Cortex Mail Guardian Review",
  enabled: true,
});

function fromAccount(a: ServerMailAccount): AccountFormValues {
  return {
    slug: a.slug,
    address: a.address,
    host: a.host,
    port: String(a.port),
    secure: a.secure,
    username: a.username,
    password: "", // never pre-filled — leave blank to keep existing
    inbox: a.inbox,
    trashMailbox: a.trashMailbox ?? "",
    reviewMailbox: a.reviewMailbox,
    enabled: a.enabled,
  };
}

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: ServerMailAccount | null;
  onSaved: () => void;
}

function AccountDialog({ open, onOpenChange, editing, onSaved }: AccountDialogProps) {
  const [form, setForm] = useState<AccountFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens.
  const handleOpenChange = (o: boolean) => {
    if (o) setForm(editing ? fromAccount(editing) : emptyForm());
    onOpenChange(o);
  };

  const set = (k: keyof AccountFormValues, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const headers = csrfHeaders();
    const port = parseInt(form.port, 10);
    const base = {
      slug: form.slug,
      address: form.address,
      host: form.host,
      port: Number.isNaN(port) ? 993 : port,
      secure: form.secure,
      username: form.username,
      inbox: form.inbox,
      trashMailbox: form.trashMailbox || null,
      reviewMailbox: form.reviewMailbox,
      enabled: form.enabled,
    };
    try {
      if (editing) {
        await callUpdateMailAccount({
          data: { ...base, ...(form.password ? { password: form.password } : {}) },
          headers,
        });
        toast.success(`Account "${form.slug}" updated`);
      } else {
        await callCreateMailAccount({ data: { ...base, password: form.password }, headers });
        toast.success(`Account "${form.slug}" created`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Edit account "${editing.slug}"` : "Add IMAP account"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            handleSubmit(e).catch(() => {});
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="acct-slug">Slug</Label>
              <Input
                id="acct-slug"
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                disabled={!!editing}
                placeholder="work-inbox"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acct-address">Email address</Label>
              <Input
                id="acct-address"
                type="email"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="ops@example.com"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_100px_80px] gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="acct-host">IMAP host</Label>
              <Input
                id="acct-host"
                value={form.host}
                onChange={(e) => set("host", e.target.value)}
                placeholder="imap.example.com"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acct-port">Port</Label>
              <Input
                id="acct-port"
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(e) => set("port", e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Checkbox
                id="acct-secure"
                checked={form.secure}
                onCheckedChange={(v) => set("secure", v === true)}
              />
              <Label htmlFor="acct-secure" className="text-sm cursor-pointer">
                TLS
              </Label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="acct-username">Username</Label>
              <Input
                id="acct-username"
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                placeholder="ops@example.com"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acct-password">
                Password
                {editing && (
                  <span className="text-muted-foreground ml-1 text-xs">(leave blank to keep)</span>
                )}
              </Label>
              <Input
                id="acct-password"
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required={!editing}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="acct-inbox">Inbox folder</Label>
              <Input
                id="acct-inbox"
                value={form.inbox}
                onChange={(e) => set("inbox", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acct-review">Review mailbox</Label>
              <Input
                id="acct-review"
                value={form.reviewMailbox}
                onChange={(e) => set("reviewMailbox", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="acct-trash">
              Trash mailbox <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="acct-trash"
              value={form.trashMailbox}
              onChange={(e) => set("trashMailbox", e.target.value)}
              placeholder="Trash"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="acct-enabled"
              checked={form.enabled}
              onCheckedChange={(v) => set("enabled", v === true)}
            />
            <Label htmlFor="acct-enabled" className="cursor-pointer">
              Enabled
            </Label>
          </div>
          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              {editing ? "Save changes" : "Add account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Accounts management pane
// ---------------------------------------------------------------------------

function AccountsPane() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;

  const {
    data: accountsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["mail", "accounts"],
    queryFn: () => callListMailAccounts({ data: {} }),
  });

  const accounts = accountsData?.accounts ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServerMailAccount | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["mail", "accounts"] });

  const handleDelete = async (slug: string) => {
    setDeleting(slug);
    try {
      await callDeleteMailAccount({ data: { slug }, headers: csrfHeaders() });
      toast.success(`Account "${slug}" deleted`);
      invalidate().catch(() => {});
    } catch {
      toast.error(`Failed to delete account "${slug}"`);
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="elev-1 p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </Card>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title="Failed to load accounts"
        description="Could not reach the mail guardian accounts database."
        action={
          <Button size="sm" variant="outline" onClick={invalidate}>
            <RefreshCw className="size-3.5 mr-1.5" />
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <>
      <AccountDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        onSaved={() => {
          invalidate().catch(() => {});
        }}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {accounts.length} IMAP account{accounts.length !== 1 ? "s" : ""} configured
          </p>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-3.5 mr-1.5" />
              Add account
            </Button>
          )}
        </div>

        {accounts.length === 0 ? (
          <EmptyState
            icon={<Server className="size-8" />}
            title="No IMAP accounts"
            description="Add an IMAP account to start monitoring a mailbox for suspicious emails."
            action={
              isAdmin ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="size-3.5 mr-1.5" />
                  Add account
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <Card key={a.slug} className="elev-1 p-4 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{a.slug}</span>
                    <Badge variant={a.enabled ? "default" : "secondary"} className="text-[10px]">
                      {a.enabled ? "enabled" : "disabled"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.address} · {a.host}:{a.port} {a.secure ? "(TLS)" : "(plain)"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    inbox: {a.inbox} · review: {a.reviewMailbox}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="Edit"
                      onClick={() => {
                        setEditing(a);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Delete"
                          disabled={deleting === a.slug}
                        >
                          {deleting === a.slug ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      }
                      title={`Delete account "${a.slug}"?`}
                      description="This will remove the IMAP account configuration. Existing reviews are kept."
                      destructive
                      requireText={a.slug}
                      confirmLabel="Delete"
                      onConfirm={() => {
                        handleDelete(a.slug).catch(() => {});
                      }}
                    />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export function MailGuardianPage() {
  const t = useT();
  const { data: mails = [] } = useQuery({
    queryKey: ["mail"],
    queryFn: api.mail,
    refetchInterval: 30_000,
  });

  const pendingCount = mails.filter((m) => m.status === "pending").length;
  const highRiskCount = mails.filter((m) => m.risk === "high").length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Mail className="size-5" />}
        title={t.nav.mail}
        description={`${pendingCount} pending review · ${highRiskCount} high-risk`}
      />

      <Tabs defaultValue="reviews" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reviews">
            <Mail className="size-3.5 mr-1.5" />
            Reviews
          </TabsTrigger>
          <TabsTrigger value="accounts">
            <Settings className="size-3.5 mr-1.5" />
            Accounts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reviews">
          <ReviewsPane />
        </TabsContent>

        <TabsContent value="accounts">
          <AccountsPane />
        </TabsContent>
      </Tabs>
    </div>
  );
}
