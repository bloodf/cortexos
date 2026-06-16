import { useQuery } from "@tanstack/react-query";
import { HardDrive } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api/client";
import { useT } from "@/hooks/useT";
import { bytes } from "@/lib/format";
import { usageBg } from "@/lib/status";
import type { MountInfo, DriveInfo } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function StoragePage() {
  const t = useT();
  const { data: sys, isError } = useQuery({
    queryKey: ["system"],
    queryFn: api.system,
    refetchInterval: 5000,
  });

  const driveCols: Column<DriveInfo>[] = [
    {
      key: "name",
      header: "Device",
      sort: (r) => r.name,
      cell: (r) => <span className="font-mono text-xs">{r.name}</span>,
    },
    { key: "model", header: "Model", cell: (r) => r.model },
    {
      key: "type",
      header: "Type",
      cell: (r) => <span className="text-xs uppercase">{r.type ?? "—"}</span>,
    },
    {
      key: "size",
      header: "Size",
      className: "text-right tabular-nums",
      sort: (r) => r.size,
      cell: (r) => bytes(r.size),
    },
    {
      key: "mount",
      header: "Mount",
      cell: (r) => <code className="text-xs">{r.mount ?? "—"}</code>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<HardDrive className="size-5" />}
        title={t.nav.storage}
        description="Block devices, mounts and pools."
      />

      {isError && (
        <EmptyState
          icon={<HardDrive className="size-6" />}
          title="Couldn't load storage data"
          description="The request failed — it will retry automatically."
        />
      )}

      <Card className="elev-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Mountpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sys?.mounts.map((m: MountInfo) => (
            <div key={m.mount} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-mono">{m.mount}</span>
                <span className="text-muted-foreground text-xs">{m.filesystem}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full", usageBg(m.percent))}
                  style={{ width: `${m.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>{bytes(m.used)} used</span>
                <span>{bytes(m.free)} free</span>
                <span>{bytes(m.total)} total</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="elev-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Block devices</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={driveCols}
            initialSort="name"
            server={{ queryKey: ["drives"], fetch: api.drivesList, refetchInterval: 5000 }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
