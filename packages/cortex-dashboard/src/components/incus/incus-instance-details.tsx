"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SkeletonTable } from "@/components/skeleton";

interface IncusDetailData {
  data?: {
    name?: string;
    status?: string;
    state?: {
      cpu?: Record<string, unknown>;
      memory?: {
        usage?: number;
        total?: number;
        swap_usage?: number;
      };
      disk?: Record<string, { usage?: number }>;
      processes?: number;
      network?: Record<
        string,
        {
          addresses?: Array<{ family: string; address: string; netmask?: string }>;
          counters?: { bytes_received?: number; bytes_sent?: number };
        }
      >;
    };
    profiles?: string[];
    snapshots?: Array<{ name: string; created_at?: string }>;
    created_at?: string;
  };
  error?: string;
}

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null) return "—";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function IncusInstanceDetails({ name, onClose }: { name: string; onClose: () => void }) {
  const [info, setInfo] = useState<IncusDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchInfo = async () => {
      try {
        const res = await fetch(`/api/incus/${encodeURIComponent(name)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as IncusDetailData;
        if (mounted) {
          setInfo(json);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setInfo({ error: e instanceof Error ? e.message : "Failed to fetch" });
          setLoading(false);
        }
      }
    };
    fetchInfo();
    return () => {
      mounted = false;
    };
  }, [name]);

  const d = info?.data;
  const state = d?.state;

  return (
    <div className="glass-panel rounded-2xl p-6 animate-[slide-in_0.4s_ease-out]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white/80 light:text-slate-700">
          {name} Details
        </h2>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>

      {loading ? (
        <SkeletonTable rows={3} cols={2} />
      ) : info?.error ? (
        <div className="text-sm text-red-400">{info.error}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">Status</p>
              <p className="text-sm text-white/60 light:text-slate-700">{d?.status || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">Processes</p>
              <p className="text-sm text-white/60 light:text-slate-700">{state?.processes ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">Memory</p>
              <p className="text-sm text-white/60 light:text-slate-700">
                {formatBytes(state?.memory?.usage)} / {formatBytes(state?.memory?.total)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">Created</p>
              <p className="text-sm text-white/60 light:text-slate-700">{d?.created_at ? new Date(d.created_at).toLocaleString() : "—"}</p>
            </div>
          </div>

          {state?.network && Object.keys(state.network).length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider mb-2">Network</p>
              <div className="space-y-1">
                {Object.entries(state.network).map(([iface, net]) => (
                  <div key={iface} className="text-sm text-white/60 light:text-slate-700">
                    <span className="font-mono text-xs">{iface}:</span>{" "}
                    {net.addresses
                      ?.filter((a) => a.family === "inet")
                      .map((a) => `${a.address}/${a.netmask || ""}`)
                      .join(", ") || "—"}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(d?.profiles) && d.profiles.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider mb-2">Profiles</p>
              <div className="flex flex-wrap gap-2">
                {d.profiles.map((p) => (
                  <span
                    key={p}
                    className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60 light:text-slate-700"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(d?.snapshots) && d.snapshots.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider mb-2">Snapshots</p>
              <div className="space-y-1">
                {d.snapshots.map((s) => (
                  <div key={s.name} className="text-sm text-white/60 light:text-slate-700 flex justify-between">
                    <span className="font-mono text-xs">{s.name}</span>
                    <span>{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
