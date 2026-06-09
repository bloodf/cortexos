import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Mail, Shield, AlertTriangle, Flag, CheckCheck, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/mocks/api";
import { useT } from "@/hooks/useT";
import type { MailReview } from "@/mocks/types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const riskColor = { low: "border-[var(--success)] text-[var(--success)]", medium: "border-[var(--warning)] text-[var(--warning)]", high: "border-[var(--destructive)] text-[var(--destructive)]" } as const;

export function MailGuardianPage() {
  const t = useT();
  const qc = useQueryClient();
  const { data: mails = [] } = useQuery({ queryKey: ["mail"], queryFn: api.mail });
  const [sel, setSel] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const active = mails.find((m) => m.id === sel) ?? mails[0];

  const allIds = useMemo(() => mails.map((m) => m.id), [mails]);
  const allChecked = picked.size > 0 && picked.size === allIds.length;
  const someChecked = picked.size > 0 && !allChecked;

  const setStatus = (id: string, status: MailReview["status"]) => {
    qc.setQueryData<MailReview[]>(["mail"], (p) => p?.map((m) => m.id === id ? { ...m, status } : m));
  };

  const togglePick = (id: string, checked: boolean) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setPicked(checked ? new Set(allIds) : new Set());
  };

  const batch = (status: MailReview["status"]) => {
    const ids = Array.from(picked);
    if (!ids.length) return;
    qc.setQueryData<MailReview[]>(["mail"], (p) => p?.map((m) => picked.has(m.id) ? { ...m, status } : m));
    toast.success(`${ids.length} email${ids.length === 1 ? "" : "s"} ${status}`);
    setPicked(new Set());
  };

  return (
    <div className="space-y-5">
      <PageHeader icon={<Mail className="size-5" />} title={t.nav.mail} description={`${mails.filter((m) => m.status === "pending").length} pending review · ${mails.filter((m) => m.risk === "high").length} high-risk`} />

      <div className="grid gap-3 lg:grid-cols-[420px_1fr]">
        <Card className="elev-1 overflow-hidden">
          {/* Batch toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
            <Checkbox
              checked={allChecked ? true : someChecked ? "indeterminate" : false}
              onCheckedChange={(v) => toggleAll(v === true)}
              aria-label="Select all"
            />
            {picked.size > 0 ? (
              <>
                <span className="text-xs text-muted-foreground">{picked.size} selected</span>
                <div className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="success" className="h-7" onClick={() => batch("approved")}>
                    <CheckCheck className="size-3.5 mr-1" />Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7" onClick={() => batch("flagged")}>
                    <Flag className="size-3.5 mr-1" />Flag
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setPicked(new Set())} aria-label="Clear selection">
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
              return (
                <div
                  key={m.id}
                  className={cn(
                    "group flex items-start gap-2 px-3 py-2.5 hover:bg-muted/30",
                    isActive && "bg-accent/50",
                    isPicked && "bg-primary/5"
                  )}
                >
                  <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isPicked}
                      onCheckedChange={(v) => togglePick(m.id, v === true)}
                      aria-label={`Select ${m.subject}`}
                    />
                  </div>
                  <button
                    onClick={() => setSel(m.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{m.from}</p>
                        <p className="text-sm truncate">{m.subject}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.snippet}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] uppercase shrink-0", riskColor[m.risk])}>{m.risk}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{relativeTime(m.received_at)} · {m.status}</p>
                  </button>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="outline-success"
                      className="h-7 w-7"
                      title="Approve"
                      onClick={(e) => { e.stopPropagation(); setStatus(m.id, "approved"); toast.success("Email approved"); }}
                    >
                      <Shield className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline-destructive"
                      className="h-7 w-7"
                      title="Flag"
                      onClick={(e) => { e.stopPropagation(); setStatus(m.id, "flagged"); toast.success("Email flagged"); }}
                    >
                      <Flag className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="elev-1 p-5 space-y-4">
          {active ? (
            <>
              <div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold">{active.subject}</h2>
                  <Badge variant="outline" className={cn(riskColor[active.risk])}>{active.risk === "high" && <AlertTriangle className="size-3 mr-1" />}{active.risk} risk</Badge>
                </div>
                <p className="text-sm text-muted-foreground">From <span className="font-mono">{active.from}</span> · {relativeTime(active.received_at)}</p>
              </div>
              <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground whitespace-pre-wrap">{active.body}</div>
              <div className="flex gap-2 pt-3 border-t">
                <Button variant="success" onClick={() => { setStatus(active.id, "approved"); toast.success("Email approved"); }}><Shield className="size-4 mr-1.5" />Approve</Button>
                <Button variant="destructive" onClick={() => { setStatus(active.id, "flagged"); toast.success("Email flagged"); }}>
                  <Flag className="size-4 mr-1.5" />Flag
                </Button>
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">Select an email.</p>}
        </Card>
      </div>
    </div>
  );
}
