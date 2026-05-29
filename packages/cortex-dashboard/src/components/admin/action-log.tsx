"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { ActionLogEntry } from "@/lib/db/action-log";

interface ActionLogProps {
  entries?: ActionLogEntry[];
}

export function ActionLog({ entries = [] }: ActionLogProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Action Log</h3>
      {entries.length === 0 ? (
        <EmptyState title="No actions recorded" />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Time
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  User
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Target
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Action
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Message
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.username || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.target_type}:{entry.target_name}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.action}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        entry.status === "success" ? "default" : "destructive"
                      }
                      className="text-[10px]"
                    >
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {entry.message || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
