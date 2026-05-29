"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SkeletonTable } from "@/components/skeleton";
import { IncusActionButtons } from "./incus-action-buttons";
import { IncusInstanceDetails } from "./incus-instance-details";
import { IncusCreateDialog } from "./incus-create-dialog";

interface IncusInstance {
  name: string;
  status: string;
  type: string;
  ipv4: string | null;
  ipv6: string | null;
  architecture: string;
  created: string;
  profiles: string[];
  snapshotsCount: number;
}

interface IncusData {
  data: IncusInstance[];
  error?: string;
}

export function IncusTable() {
  const [data, setData] = useState<IncusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<IncusInstance | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const res = await fetch("/api/incus", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as IncusData;
        if (mounted) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to fetch");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  async function refreshData() {
    try {
      const res = await fetch("/api/incus", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as IncusData;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    }
  }

  const instances = Array.isArray(data?.data) ? data.data : [];

  return (
    <div className="space-y-6 animate-[slide-in_0.4s_ease-out]">
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white/80 light:text-slate-700">
            Instances
          </h2>
          <IncusCreateDialog onCreated={refreshData} />
        </div>
        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : error ? (
          <div className="text-sm text-red-400">{error}</div>
        ) : instances.length === 0 ? (
          <div className="text-sm text-white/30 light:text-slate-700">No instances</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06]">
                  <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                    Name
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                    Status
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                    Type
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                    IPv4
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                    Architecture
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((i) => (
                  <TableRow
                    key={i.name}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                    onClick={() => setSelectedInstance(i)}
                  >
                    <TableCell className="text-white/60 light:text-slate-700 font-mono text-xs">
                      {i.name}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          i.status.toLowerCase() === "running"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : i.status.toLowerCase() === "stopped"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {i.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-white/60 light:text-slate-700 text-xs">
                      {i.type}
                    </TableCell>
                    <TableCell className="text-white/60 light:text-slate-700 font-mono text-xs">
                      {i.ipv4 || "—"}
                    </TableCell>
                    <TableCell className="text-white/60 light:text-slate-700 text-xs">
                      {i.architecture}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <IncusActionButtons
                        name={i.name}
                        status={i.status}
                        onComplete={refreshData}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedInstance && (
        <IncusInstanceDetails
          name={selectedInstance.name}
          onClose={() => setSelectedInstance(null)}
        />
      )}
    </div>
  );
}
