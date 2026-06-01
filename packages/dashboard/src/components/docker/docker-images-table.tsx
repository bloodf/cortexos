"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Image {
  Repository?: string;
  Tag?: string;
  Size?: number;
  Created?: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", { timeZone: "UTC" });
}

export function DockerImagesTable({ images }: { images: unknown[] }) {
  const rows = images as Image[];

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">No images</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border">
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Repository
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Tag
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Size
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Created
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((img) => (
                <TableRow key={`${img.Repository}:${img.Tag}`} className="border-b border-border hover:bg-muted/50">
                  <TableCell className="text-foreground text-xs">
                    {img.Repository || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">
                    {img.Tag || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">
                    {typeof img.Size === "number" ? formatBytes(img.Size) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {typeof img.Created === "number" ? formatDate(img.Created) : "—"}
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
