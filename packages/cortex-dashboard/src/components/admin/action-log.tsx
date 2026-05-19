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
import type { ActionLogEntry } from "@/lib/db/action-log";

interface ActionLogProps {
  entries?: ActionLogEntry[];
}

export function ActionLog({ entries = [] }: ActionLogProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-white/80 light:text-slate-700">
        Action Log
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-white/30 light:text-slate-700">
          No actions recorded.
        </p>
      ) : (
        <div className="border border-white/[0.06] rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                  Time
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                  User
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                  Target
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                  Action
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                  Message
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow
                  key={entry.id}
                  className="border-white/[0.03] hover:bg-white/[0.02]"
                >
                  <TableCell className="text-xs text-white/60 light:text-slate-700">
                    {new Date(entry.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-white/60 light:text-slate-700">
                    {entry.username || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-white/60 light:text-slate-700">
                    {entry.target_type}:{entry.target_name}
                  </TableCell>
                  <TableCell className="text-xs text-white/60 light:text-slate-700">
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
                  <TableCell className="text-xs text-white/60 light:text-slate-700 max-w-xs truncate">
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
