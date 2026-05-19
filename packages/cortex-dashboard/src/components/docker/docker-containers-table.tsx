"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Container {
  Names?: string[];
  Image?: string;
  Status?: string;
  State?: string;
}

function stateDotClass(state: string): string {
  switch (state) {
    case "running":
      return "bg-emerald-500";
    case "exited":
      return "bg-red-500";
    case "paused":
      return "bg-amber-500";
    default:
      return "bg-gray-500";
  }
}

function containerName(c: Container): string {
  if (Array.isArray(c.Names) && c.Names.length > 0) {
    return c.Names[0].replace(/^\//, "");
  }
  return c.Image || "—";
}

export function DockerContainersTable({ containers }: { containers: unknown[] }) {
  const rows = containers as Container[];

  return (
    <div className="glass-panel rounded-2xl p-6">
      {rows.length === 0 ? (
        <div className="text-sm text-white/30 light:text-slate-700">No containers</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/[0.06]">
                <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                  Image
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                  State
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c, i) => (
                <TableRow
                  key={i}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                >
                  <TableCell className="text-white/60 light:text-slate-700 font-mono text-xs">
                    {containerName(c)}
                  </TableCell>
                  <TableCell className="text-white/40 light:text-slate-700 text-xs">
                    {c.Image || "—"}
                  </TableCell>
                  <TableCell className="text-white/40 light:text-slate-700 text-xs">
                    {c.Status || "—"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-label={c.State || "unknown"}
                        className={`inline-block h-2 w-2 rounded-full ${stateDotClass(c.State || "")}`}
                      />
                      <span className="text-xs text-white/40 light:text-slate-700">
                        {c.State || "—"}
                      </span>
                    </span>
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
