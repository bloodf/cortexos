"use client";

import { HardDrive } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/sys-pilot/DataTable";
import { api } from "@/lib/api";

import { useQuery } from "@tanstack/react-query";
import { bytes } from "@/lib/sys-pilot/format";
import { usageBg } from "@/lib/sys-pilot/status";
import type { MountInfo, DriveInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function StoragePage() {
  const { data: sys, isLoading } = useQuery({ queryKey: ["system"], queryFn: api.system, refetchInterval: 5000 });

  const driveCols: Column<DriveInfo>[] = [
    { key: "name", header: "Device", sort: (r) => r.name, cell: (r) => <span className="font-mono text-xs">{r.name}</span> },
    { key: "model", header: "Model", cell: (r) => r.model },
    { key: "type", header: "Type", cell: (r) => <span className="text-xs uppercase">{r.type ?? "—"}</span> },
    { key: "size", header: "Size", className: "text-right tabular-nums", sort: (r) => r.size, cell: (r) => bytes(r.size) },
    { key: "mount", header: "Mount", cell: (r) => <code className="text-xs">{r.mount ?? "—"}</code> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader icon={<HardDrive className="size-5" />} title={"Storage"} description="Block devices, mounts and pools." />

      <Card className="elev-1">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Mountpoints</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {sys?.mounts.map((m: MountInfo) => (
            <div key={m.mount} className="space-y-1">
              <div className="flex justify-between text-sm"><span className="font-mono">{m.mount}</span><span className="text-muted-foreground text-xs">{m.filesystem}</span></div>
              <div className="h-2 rounded-full bg-muted overflow-hidden"><div className={cn("h-full", usageBg(m.percent))} style={{ width: `${m.percent}%` }} /></div>
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums"><span>{bytes(m.used)} used</span><span>{bytes(m.free)} free</span><span>{bytes(m.total)} total</span></div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="elev-1">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Block devices</CardTitle></CardHeader>
        <CardContent>
          <DataTable rows={sys?.drives ?? []} columns={driveCols} loading={isLoading} initialSort="name" />
        </CardContent>
      </Card>
    </div>
  );
}
