import { cn } from "@/lib/utils";

interface Props {
  value: number;
  max?: number;
  size?: number;
  label?: string;
  sublabel?: string;
  thresholds?: [number, number];
  className?: string;
}

export function GaugeRadial({
  value,
  max = 100,
  size = 120,
  label,
  sublabel,
  thresholds = [75, 90],
  className,
}: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  let color: string;
  if (pct >= thresholds[1]) color = "var(--destructive)";
  else if (pct >= thresholds[0]) color = "var(--warning)";
  else color = "var(--primary)";
  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--muted)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 600ms ease, stroke 300ms" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums">{label ?? `${Math.round(pct)}%`}</span>
        {sublabel && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
