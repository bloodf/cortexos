import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Check, X, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, callGrantApproval, callRevokeApproval } from "@/lib/api/client";
import { useT } from "@/hooks/useT";
import { useAuth } from "@/hooks/useAuth";
import type { ApprovalRequest } from "@/mocks/types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ApprovalsPage() {
  const t = useT();
  const qc = useQueryClient();
  const { user } = useAuth();
  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: ["approvals"], queryFn: api.approvals });
  const [denyFor, setDenyFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["approvals"] });

  const handleGrant = async (a: ApprovalRequest) => {
    setPending(`grant-${a.id}`);
    try {
      await callGrantApproval({ data: { id: Number(a.id) } });
      toast.success(`Approved: ${a.summary}`);
      invalidate();
    } catch {
      toast.error(`Failed to approve request`);
    } finally {
      setPending(null);
    }
  };

  const handleRevoke = async (a: ApprovalRequest, revokeReason: string) => {
    setPending(`deny-${a.id}`);
    try {
      await callRevokeApproval({ data: { id: Number(a.id) } });
      toast.success(`Denied: ${a.summary}${revokeReason ? ` — ${revokeReason}` : ""}`);
      invalidate();
    } catch {
      toast.error(`Failed to deny request`);
    } finally {
      setPending(null);
      setDenyFor(null);
      setReason("");
    }
  };

  const open = items.filter((i) => i.status === "pending");
  const resolved = items.filter((i) => i.status !== "pending");

  const card = (a: ApprovalRequest) => {
    const isGranting = pending === `grant-${a.id}`;
    const isDenying = pending === `deny-${a.id}`;
    return (
      <Card key={a.id} className="elev-1 p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm">{a.summary}</p>
            <p className="text-xs text-muted-foreground">
              <code>{a.tool}</code> · {a.actor} · {relativeTime(a.requested_at)}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              a.status === "approved" && "border-[var(--success)] text-[var(--success)]",
              a.status === "denied" && "border-destructive text-destructive",
            )}
          >
            {a.status}
          </Badge>
        </div>
        <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
          <code>{a.args_preview}</code>
        </pre>
        {a.reason && <p className="text-xs text-muted-foreground italic">Reason: {a.reason}</p>}
        {a.status === "pending" && user?.is_admin && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" disabled={!!pending} onClick={() => handleGrant(a)}>
              {isGranting ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : (
                <Check className="size-3.5 mr-1" />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!!pending}
              onClick={() => {
                setDenyFor(a.id);
                setReason("");
              }}
            >
              {isDenying ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : (
                <X className="size-3.5 mr-1" />
              )}
              Deny
            </Button>
          </div>
        )}
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader
          icon={<CheckCircle2 className="size-5" />}
          title={t.nav.approvals}
          description="Loading…"
        />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="elev-1 p-4 h-24 animate-pulse bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-5">
        <PageHeader
          icon={<CheckCircle2 className="size-5" />}
          title={t.nav.approvals}
          description="Error loading approvals"
        />
        <p className="text-sm text-destructive">Failed to load approvals. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<CheckCircle2 className="size-5" />}
        title={t.nav.approvals}
        description={`${open.length} pending`}
      />
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({open.length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4 space-y-3">
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending approvals.</p>
          ) : (
            open.map(card)
          )}
        </TabsContent>
        <TabsContent value="resolved" className="mt-4 space-y-3">
          {resolved.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resolved approvals.</p>
          ) : (
            resolved.map(card)
          )}
        </TabsContent>
      </Tabs>
      <Dialog open={!!denyFor} onOpenChange={(o) => !o && setDenyFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny request</DialogTitle>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyFor(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!pending}
              onClick={() => {
                const target = items.find((i) => i.id === denyFor);
                if (target) void handleRevoke(target, reason);
              }}
            >
              {pending?.startsWith("deny-") ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : null}
              Deny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
