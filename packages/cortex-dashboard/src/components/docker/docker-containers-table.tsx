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
      return "bg-success";
    case "exited":
      return "bg-destructive";
    case "paused":
      return "bg-warning";
    default:
      return "bg-muted-foreground";
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
    <div className="rounded-xl border border-border bg-card p-6">
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">No containers</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border">
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Image
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  State
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c, i) => (
                <TableRow key={i} className="border-b border-border hover:bg-muted/50">
                  <TableCell className="text-foreground font-mono text-xs">
                    {containerName(c)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {c.Image || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {c.Status || "—"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-label={c.State || "unknown"}
                        className={`inline-block h-2 w-2 rounded-full ${stateDotClass(c.State || "")}`}
                      />
                      <span className="text-xs text-muted-foreground">
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
