"use client";

import { useState } from "react";
import { Mail, Shield, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MailReview } from "@/lib/types";
import { relativeTime } from "@/lib/sys-pilot/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const riskColor: Record<string, string> = { low: "border-[var(--success)] text-[var(--success)]", medium: "border-[var(--warning)] text-[var(--warning)]", high: "border-[var(--destructive)] text-[var(--destructive)]" };

export default function MailGuardianPage() {
  const t = useTranslations();
  const qc = useQueryClient();
  const { data: mails = [] } = useQuery({ queryKey: ["mail"], queryFn: api.mailGuardian });
  const [sel, setSel] = useState<string | null>(null);
  const active = mails.find((m) => m.id === sel) ?? mails[0];

  const setStatus = (id: string, status: MailReview["status"]) => {
    qc.setQueryData<MailReview[]>(["mail"], (p) => p?.map((m) => m.id === id ? { ...m, status } : m));
    toast.success(`Email ${status}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader icon={<Mail className="size-5" />} title={"Mail"} description={`${mails.filter((m) => m.status === "pending").length} pending review · ${mails.filter((m) => m.risk === "high").length} high-risk`} />
      <div className="grid gap-3 lg:grid-cols-[400px_1fr]">
        <Card className="elev-1 divide-y">
          {mails.map((m) => (
            <button key={m.id} onClick={() => setSel(m.id)} className={cn("w-full text-left px-3 py-2.5 hover:bg-muted/30", (active?.id === m.id) && "bg-accent/50")}>
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
          ))}
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
                <Button onClick={() => setStatus(active.id, "approved")}><Shield className="size-4 mr-1.5" />Approve</Button>
                <Button variant="destructive" onClick={() => setStatus(active.id, "flagged")}>Flag</Button>
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">Select an email.</p>}
        </Card>
      </div>
    </div>
  );
}
