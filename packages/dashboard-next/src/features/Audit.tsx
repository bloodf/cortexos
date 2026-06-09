import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollText, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { KeyValueList } from "@/components/KeyValueList";
import { Badge } from "@/components/ui/badge";
import { api, callVerifyAudit } from "@/lib/api/client";
import { useT } from "@/hooks/useT";
import type { AuditEntry } from "@/mocks/types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AuditPage() {
  const t = useT();
  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ["audit"],
    queryFn: api.audit,
  });
  const { data: chainResult, isLoading: chainLoading } = useQuery({
    queryKey: ["audit", "verify"],
    queryFn: () => callVerifyAudit({ data: {} }),
    // Verify once on mount; re-run every 5 minutes.
    staleTime: 5 * 60 * 1000,
  });
  const [sel, setSel] = useState<AuditEntry | null>(null);

  const cols: Column<AuditEntry>[] = [
    {
      key: "created_at",
      header: "When",
      sort: (r) => r.created_at,
      cell: (r) => <span className="text-xs text-muted-foreground">{relativeTime(r.created_at)}</span>,
    },
    {
      key: "actor",
      header: "Actor",
      sort: (r) => r.actor,
      cell: (r) => <code className="text-xs">{r.actor}</code>,
    },
    {
      key: "tool",
      header: "Tool",
      cell: (r) => <code className="text-xs">{r.tool}</code>,
    },
    {
      key: "class",
      header: "Class",
      cell: (r) => <Badge variant="outline">{r.tool_class}</Badge>,
    },
    {
      key: "decision",
      header: "Decision",
      sort: (r) => r.decision,
      cell: (r) => (
        <Badge
          variant="outline"
          className={cn(
            r.decision === "allow"
              ? "border-[var(--success)] text-[var(--success)]"
              : "border-destructive text-destructive",
          )}
        >
          {r.decision}
        </Badge>
      ),
    },
    {
      key: "result",
      header: "Result",
      cell: (r) => <span className="text-xs">{r.result}</span>,
    },
    {
      key: "act",
      header: "",
      cell: (r) => (
        <button onClick={() => setSel(r)} className="text-xs text-primary hover:underline">
          view
        </button>
      ),
    },
  ];

  const chainBadge = () => {
    if (chainLoading) {
      return (
        <Badge variant="outline">
          <Loader2 className="size-3 mr-1 animate-spin" />
          Verifying chain…
        </Badge>
      );
    }
    if (!chainResult) return null;
    if (chainResult.ok) {
      return (
        <Badge variant="outline" className="border-[var(--success)] text-[var(--success)]">
          <ShieldCheck className="size-3 mr-1" />
          chain valid ({chainResult.count})
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-destructive text-destructive">
        <ShieldAlert className="size-3 mr-1" />
        chain broken at #{chainResult.brokenAt.id}
      </Badge>
    );
  };

  const description = isLoading
    ? "Loading…"
    : isError
      ? "Error loading audit log"
      : `${items.length} entries · hash-chained`;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<ScrollText className="size-5" />}
        title={t.nav.audit}
        description={description}
        actions={chainBadge()}
      />
      {isError ? (
        <p className="text-sm text-destructive">Failed to load audit log. Please try again.</p>
      ) : (
        <DataTable
          columns={cols}
          initialSort="created_at"
          initialSortDir="desc"
          loading={isLoading}
          server={{ queryKey: ["audit", "list"], fetch: api.auditList }}
        />
      )}
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle>Audit entry</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <KeyValueList
                  items={[
                    { key: "ID", value: sel.id },
                    { key: "Actor", value: sel.actor },
                    { key: "Tool", value: sel.tool },
                    { key: "Class", value: sel.tool_class },
                    { key: "Decision", value: sel.decision },
                    { key: "Reason", value: sel.decision_reason },
                    { key: "Result", value: sel.result },
                    { key: "Hash", value: <span className="text-[10px]">{sel.args_hash}</span> },
                    { key: "Time", value: sel.created_at },
                  ]}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
