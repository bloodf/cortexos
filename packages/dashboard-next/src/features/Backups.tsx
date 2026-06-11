import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Download, HardDrive, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { bytes, relativeTime } from "@/lib/format";
import { api } from "@/lib/api/client";
import type { BackupRunRow } from "@/lib/api/client";

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
      <div className="size-9 rounded-md bg-primary/10 text-primary grid place-items-center">
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium font-mono">{value}</div>
      </div>
    </div>
  );
}

export function BackupsPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.is_admin;
  const qc = useQueryClient();
  const { data: snaps = [] } = useQuery({ queryKey: ["backups"], queryFn: api.backups });

  const totalBytes = snaps.reduce((s, x) => s + (x.sizeBytes ?? 0), 0);
  const ok = snaps.filter((x) => x.status === "success").length;
  const newest = snaps.length
    ? snaps
        .map((s) => s.timestamp)
        .sort()
        .reverse()[0]
    : null;

  const restore = (s: BackupRunRow) =>
    toast.success(`Restore queued for ${s.target}`, { description: "Simulated restore." });
  const download = (s: BackupRunRow) =>
    toast.success("Download started", { description: s.target });
  const createSnap = () => {
    const fresh: BackupRunRow = {
      id: `s${Date.now()}`,
      target: "tank/manual",
      timestamp: new Date().toISOString(),
      sizeBytes: Math.round(1_000_000_000 + Math.random() * 4_000_000_000),
      status: "running",
    };
    qc.setQueryData<BackupRunRow[]>(["backups"], (p) => [fresh, ...(p ?? [])]);
    toast.success("Snapshot started", { description: fresh.target });
    setTimeout(() => {
      qc.setQueryData<BackupRunRow[]>(["backups"], (p) =>
        p?.map((x) => (x.id === fresh.id ? { ...x, status: "success" } : x)),
      );
    }, 1500);
  };

  const cols: Column<BackupRunRow>[] = [
    {
      key: "target",
      header: "Target",
      sort: (r) => r.target,
      cell: (r) => <span className="font-medium">{r.target}</span>,
    },
    {
      key: "sizeBytes",
      header: "Size",
      sort: (r) => r.sizeBytes ?? -1,
      cell: (r) => (
        <span className="font-mono text-xs">{r.sizeBytes === null ? "—" : bytes(r.sizeBytes)}</span>
      ),
    },
    {
      key: "timestamp",
      header: "Created",
      sort: (r) => r.timestamp,
      cell: (r) => (
        <span className="text-xs text-muted-foreground">{relativeTime(r.timestamp)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => {
        let statusClass = "border-muted-foreground text-muted-foreground";
        if (r.status === "success") statusClass = "border-[var(--success)] text-[var(--success)]";
        else if (r.status === "failed") statusClass = "border-destructive text-destructive";
        else if (r.status === "running") statusClass = "border-primary text-primary";
        return (
          <Badge variant="outline" className={statusClass}>
            {r.status}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex items-center gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => download(r)} aria-label="Download">
            <Download className="size-3.5" />
          </Button>
          {isAdmin && (
            <Button size="sm" variant="ghost" onClick={() => restore(r)} aria-label="Restore">
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Database className="size-5" />}
        title="Backups & snapshots"
        description="ZFS snapshots, Docker volume archives, and Postgres dumps in one place."
        actions={
          isAdmin && (
            <Button size="sm" onClick={createSnap}>
              <Plus className="size-4 mr-1" />
              New snapshot
            </Button>
          )
        }
      />

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat
          icon={<HardDrive className="size-4" />}
          label="Total stored"
          value={bytes(totalBytes)}
        />
        <Stat
          icon={<Database className="size-4" />}
          label="Healthy snapshots"
          value={`${ok} / ${snaps.length}`}
        />
        <Stat
          icon={<RotateCcw className="size-4" />}
          label="Newest"
          value={newest ? relativeTime(newest) : "—"}
        />
      </div>

      <DataTable
        columns={cols}
        initialSort="timestamp"
        initialSortDir="desc"
        server={{ queryKey: ["backups"], fetch: api.backupsList }}
      />
    </div>
  );
}
