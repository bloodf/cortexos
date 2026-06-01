import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { NetworkData, NetworkInterface } from "@/lib/types";
import { kbps } from "@/lib/sys-pilot/format";
import { cn } from "@/lib/utils";

/**
 * Lightweight SVG topology: WAN → router → host → interfaces. Pulses on
 * the active link tinted by current throughput.
 */
export function NetworkTopology({ className }: { className?: string }) {
  const { data: net } = useQuery<NetworkData>({ queryKey: ["network"], queryFn: api.network, refetchInterval: 3000 });
  const interfaces: NetworkInterface[] = net?.interfaces ?? [];
  const total = interfaces.reduce((a, i) => a + (i.rxKbps ?? 0) + (i.txKbps ?? 0), 0);

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Network topology</h3>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Aggregate {kbps(total)}
        </span>
      </div>
      <svg viewBox="0 0 600 220" className="w-full h-[220px]" role="img" aria-label="Network topology diagram">
        <defs>
          <linearGradient id="netLink" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.1" />
            <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        <Node x={50} y={110} label="WAN" sub="0.0.0.0/0" />
        <Link x1={90} y1={110} x2={210} y2={110} />
        <Node x={250} y={110} label="Edge" sub="caddy · ufw" />
        <Link x1={290} y1={110} x2={410} y2={110} primary />
        <Node x={450} y={110} label="Host" sub="cortex" highlighted />

        {interfaces.slice(0, 5).map((iface, idx) => {
          const y = 30 + idx * 38;
          const intensity = Math.min(1, (iface.rxKbps + iface.txKbps) / 4000);
          return (
            <g key={iface.name}>
              <line x1={490} y1={110} x2={540} y2={y + 12} stroke="var(--border)" strokeWidth="1.2" />
              <rect x={540} y={y} width={50} height={24} rx={4}
                fill="var(--card)" stroke="var(--border)" />
              <circle cx={547} cy={y + 12} r={3} fill="var(--primary)" opacity={0.4 + intensity * 0.6}>
                <animate attributeName="opacity" values={`${0.4 + intensity * 0.6};1;${0.4 + intensity * 0.6}`} dur="2s" repeatCount="indefinite" />
              </circle>
              <text x={555} y={y + 16} fontSize="10" fill="currentColor" className="font-mono">{iface.name}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Node({ x, y, label, sub, highlighted }: { x: number; y: number; label: string; sub?: string; highlighted?: boolean }) {
  return (
    <g>
      <rect x={x - 40} y={y - 22} width={80} height={44} rx={8}
        fill={highlighted ? "var(--primary)" : "var(--card)"}
        stroke={highlighted ? "var(--primary)" : "var(--border)"}
        strokeWidth="1.4"
      />
      <text x={x} y={y - 2} textAnchor="middle" fontSize="12" fontWeight="600"
        fill={highlighted ? "var(--primary-foreground)" : "currentColor"}
      >{label}</text>
      {sub && (
        <text x={x} y={y + 12} textAnchor="middle" fontSize="9"
          fill={highlighted ? "var(--primary-foreground)" : "var(--muted-foreground)"}
        >{sub}</text>
      )}
    </g>
  );
}

function Link({ x1, y1, x2, y2, primary }: { x1: number; y1: number; x2: number; y2: number; primary?: boolean }) {
  return (
    <>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={primary ? "url(#netLink)" : "var(--border)"} strokeWidth="2" />
      <circle cx={x1} cy={y1} r="3" fill="var(--primary)">
        <animate attributeName="cx" from={x1} to={x2} dur="2.5s" repeatCount="indefinite" />
      </circle>
    </>
  );
}
