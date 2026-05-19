"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Volume {
  Name?: string;
  Driver?: string;
  Mountpoint?: string;
}

export function DockerVolumesTable({ volumes }: { volumes: unknown[] }) {
  const rows = volumes as Volume[];

  return (
    <div className="glass-panel rounded-2xl p-6">
      {rows.length === 0 ? (
        <div className="text-sm text-white/30 light:text-slate-700">No volumes</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/[0.06]">
                <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                  Driver
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                  Mountpoint
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v, i) => (
                <TableRow
                  key={i}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                >
                  <TableCell className="text-white/60 light:text-slate-700 font-mono text-xs">
                    {v.Name || "—"}
                  </TableCell>
                  <TableCell className="text-white/40 light:text-slate-700 text-xs">
                    {v.Driver || "—"}
                  </TableCell>
                  <TableCell className="text-white/40 light:text-slate-700 text-xs font-mono truncate max-w-[300px]">
                    {v.Mountpoint || "—"}
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
