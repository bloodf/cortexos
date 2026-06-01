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
    <div className="rounded-xl border border-border bg-card p-6">
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">No volumes</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border">
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Driver
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Mountpoint
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((v) => (
                <TableRow key={v.Name ?? "unknown"} className="border-b border-border hover:bg-muted/50">
                  <TableCell className="text-foreground font-mono text-xs">
                    {v.Name || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {v.Driver || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono truncate max-w-[300px]">
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
