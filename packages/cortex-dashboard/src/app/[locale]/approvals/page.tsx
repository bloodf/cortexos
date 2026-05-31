"use client";

import { useState } from "react";
import { CheckCircle2, Check, X } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import type { ApprovalRequest } from "@/lib/types";
import { relativeTime } from "@/lib/sys-pilot/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ApprovalsPage() {
  const t = useTranslations();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: items = [] } = useQuery({ queryKey: ["approvals"], queryFn: api.approvals });
  const [denyFor, setDenyFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const setStatus = (id: string, status: ApprovalRequest["status"], r?: string) => {
    qc.setQueryData<ApprovalRequest[]>(["approvals"], (p) => p?.map((a) => a.id === id ? { ...a, status, reason: r } : a));
    toast.success(`Request ${status}`);
  };

  const pending = items.filter((i) => i.status === "pending");
  const resolved = items.filter((i) => i.status !== "pending");

  const card = (a: ApprovalRequest) => (
    <Card key={a.id} className="elev-1 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm">{a.summary}</p>
          <p className="text-xs text-muted-foreground"><code>{a.tool}</code> · {a.actor} · {relativeTime(a.requested_at)}</p>
        </div>
        <Badge variant="outline" className={cn(a.status === "approved" && "border-[var(--success)] text-[var(--success)]", a.status === "denied" && "border-destructive text-destructive")}>{a.status}</Badge>
      </div>
      <pre className="text-xs bg-muted rounded p-2 overflow-x-auto"><code>{a.args_preview}</code></pre>
      {a.reason && <p className="text-xs text-muted-foreground italic">Reason: {a.reason}</p>}
      {a.status === "pending" && user?.is_admin && (
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={() => setStatus(a.id, "approved")}><Check className="size-3.5 mr-1" />Approve</Button>
          <Button size="sm" variant="outline" onClick={() => { setDenyFor(a.id); setReason(""); }}><X className="size-3.5 mr-1" />Deny</Button>
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-5">
      <PageHeader icon={<CheckCircle2 className="size-5" />} title={"Approvals"} description={`${pending.length} pending`} />
      <Tabs defaultValue="pending">
        <TabsList><TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger><TabsTrigger value="resolved">Resolved ({resolved.length})</TabsTrigger></TabsList>
        <TabsContent value="pending" className="mt-4 space-y-3">{pending.length === 0 ? <p className="text-sm text-muted-foreground">No pending approvals.</p> : pending.map(card)}</TabsContent>
        <TabsContent value="resolved" className="mt-4 space-y-3">{resolved.map(card)}</TabsContent>
      </Tabs>
      <Dialog open={!!denyFor} onOpenChange={(o) => !o && setDenyFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deny request</DialogTitle></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyFor(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!reason.trim()} onClick={() => { if (denyFor) setStatus(denyFor, "denied", reason); setDenyFor(null); }}>Deny</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
