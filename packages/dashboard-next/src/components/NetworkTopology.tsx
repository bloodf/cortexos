import { useQuery } from "@tanstack/react-query";
import { api } from "@/mocks/api";
import { kbps } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Lightweight SVG topology: WAN → Edge → Host → interfaces.
 * Auto-spaces interface leaves so they don't overlap the Host node,
 * and animates a packet along the active path tinted by throughput.
 */
export function NetworkTopology({ className }: { className?: string }) {
  const { data: net } = useQuery({ queryKey: ["network"], queryFn: api.network, refetchInterval: 3000 });
  const interfaces = net?.interfaces ?? [];
  const total = interfaces.reduce((a, i) => a + i.rxKbps + i.txKbps, 0);

  // Layout
  const W = 760;
  const H = 60 + Math.max(1, interfaces.length) * 44;
  const midY = H / 2;
  const wanX = 70;
  const edgeX = 260;
  const hostX = 470;
  const ifaceX = 640;

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">Network topology</h3>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Aggregate {kbps(total)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} role="img" aria-label="Network topology diagram">
        <defs>
          <linearGradient id="netLink" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        <Node x={wanX} y={midY} label="WAN" sub="0.0.0.0/0" />
        <Link x1={wanX + 42} y1={midY} x2={edgeX - 42} y2={midY} />
        <Node x={edgeX} y={midY} label="Edge" sub="caddy · ufw" />
        <Link x1={edgeX + 42} y1={midY} x2={hostX - 42} y2={midY} primary />
        <Node x={hostX} y={midY} label="Host" sub="cortex" highlighted />

        {interfaces.map((iface, idx) => {
          const count = interfaces.length;
          const y = (H / (count + 1)) * (idx + 1);
          const intensity = Math.min(1, (iface.rxKbps + iface.txKbps) / 4000);
          return (
            <g key={iface.name}>
              <line
                x1={hostX + 42}
                y1={midY}
                x2={ifaceX - 4}
                y2={y}
                stroke="var(--primary)"
                strokeOpacity={0.25 + intensity * 0.55}
                strokeWidth="1.2"
              />
              <rect x={ifaceX} y={y - 12} width={90} height={24} rx={6}
                fill="var(--card)" stroke="var(--border)" />
              <circle cx={ifaceX + 8} cy={y} r={3} fill="var(--primary)" opacity={0.4 + intensity * 0.6}>
                <animate attributeName="opacity" values={`${0.4 + intensity * 0.6};1;${0.4 + intensity * 0.6}`} dur="2s" repeatCount="indefinite" />
              </circle>
              <text x={ifaceX + 18} y={y + 4} fontSize="11" fill="currentColor" className="font-mono">{iface.name}</text>
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
      <rect x={x - 42} y={y - 22} width={84} height={44} rx={8}
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
