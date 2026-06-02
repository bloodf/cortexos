"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MailReview } from "@/lib/types";
import { relativeTime } from "@/lib/sys-pilot/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function verdictColor(verdict: string): string {
  const v = verdict.toLowerCase();
  if (v === "spam" || v === "malicious" || v === "phish") return "border-[var(--destructive)] text-[var(--destructive)]";
  if (v === "suspicious" || v === "review") return "border-[var(--warning)] text-[var(--warning)]";
  return "border-[var(--success)] text-[var(--success)]";
}

async function decide(id: string, decision: "keep" | "spam" | "block_sender" | "allow_sender"): Promise<void> {
  const res = await fetch("/api/mail-guardian/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, decision }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }
}

export default function MailGuardianPage() {
  const qc = useQueryClient();
  const { data: mails = [], isLoading } = useQuery({
    queryKey: ["mail"],
    queryFn: api.mailGuardian,
    refetchInterval: 5000,
  });
  const [sel, setSel] = useState<string | null>(null);
  const active = mails.find((m) => m.id === sel) ?? mails[0] ?? null;

  const handleDecide = async (id: string, decision: "keep" | "spam" | "block_sender" | "allow_sender") => {
    try {
      await decide(id, decision);
      toast.success(`Decision recorded: ${decision.replace("_", " ")}`);
      qc.invalidateQueries({ queryKey: ["mail"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const awaiting = mails.filter((m) => !m.owner_decision && m.queued_status !== "done").length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Mail className="size-5" />}
        title="Mail Guardian"
        description={`${mails.length} reviews · ${awaiting} awaiting decision`}
      />
      <div className="grid gap-3 lg:grid-cols-[400px_1fr]">
        {/* Left list */}
        <Card className="elev-1 divide-y">
          {isLoading && (
            <p className="text-sm text-muted-foreground px-3 py-4">Loading…</p>
          )}
          {!isLoading && mails.length === 0 && (
            <p className="text-sm text-muted-foreground px-3 py-4">No reviews found.</p>
          )}
          {mails.map((m: MailReview) => (
            <button
              type="button"
              key={m.id}
              onClick={() => setSel(m.id)}
              className={cn("w-full text-left px-3 py-2.5 hover:bg-muted/30", active?.id === m.id && "bg-accent/50")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{m.account_slug}</p>
                  <p className="text-xs font-mono text-muted-foreground truncate">{m.message_id ?? m.message_uid}</p>
                </div>
                <Badge variant="outline" className={cn("text-[10px] uppercase shrink-0", verdictColor(m.model_verdict))}>
                  {m.model_verdict}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {relativeTime(m.requested_at)} · {m.owner_decision ?? m.queued_status ?? "pending"}
              </p>
            </button>
          ))}
        </Card>

        {/* Right detail panel */}
        <Card className="elev-1 p-5 space-y-4">
          {!active ? (
            <p className="text-sm text-muted-foreground">Select a review.</p>
          ) : (
            <>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h2 className="text-lg font-semibold">{active.account_slug}</h2>
                <Badge variant="outline" className={cn(verdictColor(active.model_verdict))}>
                  {active.model_verdict} · {active.model_confidence}
                </Badge>
              </div>

              <p className="text-xs font-mono text-muted-foreground break-all">
                {active.message_id ?? active.message_uid}
              </p>

              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground font-medium">Requested</dt>
                <dd>{relativeTime(active.requested_at)}</dd>

                <dt className="text-muted-foreground font-medium">Resolved</dt>
                <dd>{active.resolved_at ? relativeTime(active.resolved_at) : "—"}</dd>

                <dt className="text-muted-foreground font-medium">Owner decision</dt>
                <dd>{active.owner_decision ?? "—"}</dd>

                <dt className="text-muted-foreground font-medium">Queue status</dt>
                <dd>
                  {active.queued_status ?? "—"}
                  {active.processed_action ? ` (${active.processed_action})` : ""}
                </dd>

                {active.approver && (
                  <>
                    <dt className="text-muted-foreground font-medium">Approver</dt>
                    <dd>{active.approver}</dd>
                  </>
                )}

                {active.queued_error && (
                  <>
                    <dt className="text-muted-foreground font-medium">Error</dt>
                    <dd className="text-destructive">{active.queued_error}</dd>
                  </>
                )}
              </dl>

              <div className="flex flex-wrap gap-2 pt-3 border-t">
                <Button
                  disabled={active.queued_status === "done"}
                  onClick={() => handleDecide(active.id, "keep")}
                >
                  Keep
                </Button>
                <Button
                  variant="destructive"
                  disabled={active.queued_status === "done"}
                  onClick={() => handleDecide(active.id, "spam")}
                >
                  Spam
                </Button>
                <Button
                  variant="destructive"
                  disabled={active.queued_status === "done"}
                  onClick={() => handleDecide(active.id, "block_sender")}
                >
                  Block sender
                </Button>
                <Button
                  disabled={active.queued_status === "done"}
                  onClick={() => handleDecide(active.id, "allow_sender")}
                >
                  Allow sender
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
