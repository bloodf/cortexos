import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Series { key: string; color: string; name: string }
interface Props { data: Record<string, number | string>[]; series: Series[]; height?: number | string; yDomain?: [number, number]; xKey?: string }

export function AreaTrend({ data, series, height = 160, yDomain, xKey = "t" }: Props) {
  return (
    <ResponsiveContainer width="100%" height={(height as number) ?? "100%"}>

      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <XAxis dataKey={xKey} tick={false} axisLine={false} />
        <YAxis domain={yDomain} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--muted-foreground)" }}
          formatter={(v: number) => v.toFixed(1)}
        />
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={1.6} fill={`url(#g-${s.key})`} isAnimationActive={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
