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
import { DockerActionButtons } from "./action-buttons";

interface CliContainer {
  ID: string;
  Names: string;
  Image: string;
  Command: string;
  CreatedAt: string;
  Ports: string;
  State: string;
  Status: string;
  Networks: string;
  Size: string;
}

interface CliVolume {
  Name: string;
  Driver: string;
  Mountpoint: string;
  Scope: string;
  Labels: string;
}

interface CliImage {
  ID: string;
  Repository: string;
  Tag: string;
  Size: string;
  CreatedSince: string;
}

interface DockerResult<T> {
  data: T[];
  error?: string;
}

interface DockerData {
  containers: DockerResult<CliContainer>;
  volumes: DockerResult<CliVolume>;
  images: DockerResult<CliImage>;
}

export function DockerTable() {
  const [data, setData] = useState<DockerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const res = await fetch("/api/docker", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DockerData;
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
      const res = await fetch("/api/docker", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DockerData;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    }
  }

  const containers = Array.isArray(data?.containers?.data) ? data.containers.data : [];
  const volumes = Array.isArray(data?.volumes?.data) ? data.volumes.data : [];
  const images = Array.isArray(data?.images?.data) ? data.images.data : [];

  return (
    <div className="space-y-6 animate-[slide-in_0.4s_ease-out]">
      {/* Containers */}
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/80 light:text-slate-700 mb-4">
          Containers
        </h2>
        {loading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : error ? (
          <div className="text-sm text-red-400">{error}</div>
        ) : containers.length === 0 ? (
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
                    Status
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                    Image
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                    Ports
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {containers.map((c) => (
                  <TableRow
                    key={c.ID}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                  >
                    <TableCell className="text-white/60 light:text-slate-700 font-mono text-xs">
                      {c.Names}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          c.State === "running"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : c.State === "paused"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {c.Status}
                      </span>
                    </TableCell>
                    <TableCell className="text-white/40 light:text-slate-700 text-xs">
                      {c.Image}
                    </TableCell>
                    <TableCell className="text-white/40 light:text-slate-700 text-xs font-mono">
                      {c.Ports || "—"}
                    </TableCell>
                    <TableCell>
                      <DockerActionButtons name={c.Names} onComplete={refreshData} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Volumes */}
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/80 light:text-slate-700 mb-4">
          Volumes
        </h2>
        {loading ? (
          <SkeletonTable rows={5} cols={3} />
        ) : error ? (
          <div className="text-sm text-red-400">{error}</div>
        ) : volumes.length === 0 ? (
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
                {volumes.map((v) => (
                  <TableRow
                    key={v.Name}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                  >
                    <TableCell className="text-white/60 light:text-slate-700 font-mono text-xs">
                      {v.Name}
                    </TableCell>
                    <TableCell className="text-white/40 light:text-slate-700 text-xs">
                      {v.Driver}
                    </TableCell>
                    <TableCell className="text-white/40 light:text-slate-700 text-xs font-mono truncate max-w-[300px]">
                      {v.Mountpoint}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Images */}
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white/80 light:text-slate-700 mb-4">
          Images
        </h2>
        {loading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : error ? (
          <div className="text-sm text-red-400">{error}</div>
        ) : images.length === 0 ? (
          <div className="text-sm text-white/30 light:text-slate-700">No images</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06]">
                  <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                    Repository
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                    Tag
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                    Size
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
                    Created
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {images.map((img) => (
                  <TableRow
                    key={img.ID}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                  >
                    <TableCell className="text-white/60 light:text-slate-700 text-xs">
                      {img.Repository}
                    </TableCell>
                    <TableCell className="text-white/40 light:text-slate-700 text-xs font-mono">
                      {img.Tag}
                    </TableCell>
                    <TableCell className="text-white/40 light:text-slate-700 text-xs font-mono">
                      {img.Size}
                    </TableCell>
                    <TableCell className="text-white/40 light:text-slate-700 text-xs">
                      {img.CreatedSince}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
