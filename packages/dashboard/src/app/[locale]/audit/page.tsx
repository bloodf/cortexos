"use client";

import { useState } from "react";
import { ScrollText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { KeyValueList } from "@/components/sys-pilot/KeyValueList";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

import { useQuery } from "@tanstack/react-query";
import type { AuditEntry } from "@/lib/types";
import { relativeTime } from "@/lib/sys-pilot/format";
import { cn } from "@/lib/utils";

export default function AuditPage() {
  const { data: items = [] } = useQuery({ queryKey: ["audit"], queryFn: api.audit });
  const [sel, setSel] = useState<AuditEntry | null>(null);

  const cols: Column<AuditEntry>[] = [
    { key: "ts", header: "When", sort: (r) => r.created_at, cell: (r) => <span className="text-xs text-muted-foreground">{relativeTime(r.created_at)}</span> },
    { key: "actor", header: "Actor", sort: (r) => r.actor, cell: (r) => <code className="text-xs">{r.actor}</code> },
    { key: "tool", header: "Tool", cell: (r) => <code className="text-xs">{r.tool}</code> },
    { key: "class", header: "Class", cell: (r) => <Badge variant="outline">{r.tool_class}</Badge> },
    { key: "decision", header: "Decision", sort: (r) => r.decision, cell: (r) => <Badge variant="outline" className={cn(r.decision === "allow" ? "border-[var(--success)] text-[var(--success)]" : "border-destructive text-destructive")}>{r.decision}</Badge> },
    { key: "result", header: "Result", cell: (r) => <span className="text-xs">{r.result}</span> },
    { key: "act", header: "", cell: (r) => <button type="button" onClick={() => setSel(r)} className="text-xs text-primary hover:underline">view</button> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader icon={<ScrollText className="size-5" />} title={"Audit"}
        description={`${items.length} entries · hash-chained`}
        actions={<Badge variant="outline" className="border-[var(--success)] text-[var(--success)]"><ShieldCheck className="size-3 mr-1" />chain valid</Badge>}
      />
      <DataTable rows={items} columns={cols} initialSort="ts" filterFn={(r, q) => r.actor.toLowerCase().includes(q) || r.tool.includes(q)} />
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {sel && <><SheetHeader><SheetTitle>Audit entry</SheetTitle></SheetHeader>
            <div className="mt-4"><KeyValueList items={[
              { key: "ID", value: sel.id },
              { key: "Actor", value: sel.actor },
              { key: "Tool", value: sel.tool },
              { key: "Class", value: sel.tool_class },
              { key: "Decision", value: sel.decision },
              { key: "Reason", value: sel.decision_reason },
              { key: "Result", value: sel.result },
              { key: "Hash", value: <span className="text-[10px]">{sel.args_hash}</span> },
              { key: "Time", value: sel.created_at },
            ]} /></div></>}
        </SheetContent>
      </Sheet>
    </div>
  );
}
