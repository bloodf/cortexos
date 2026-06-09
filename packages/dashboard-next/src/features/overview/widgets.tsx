import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Activity, Cpu, MemoryStick, HardDrive, Thermometer, AlertTriangle,
  Container, ArrowDown, ArrowUp, Clock, Database, BarChart3, Wifi, Boxes, Fan,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/components/MetricCard";
import { WidgetShell } from "@/components/WidgetShell";
import { GaugeRadial } from "@/components/GaugeRadial";
import { Sparkline } from "@/components/Sparkline";
import { AreaTrend } from "@/components/AreaTrend";
import { api } from "@/mocks/api";
import { bytes, kbps, duration, percent, relativeTime } from "@/lib/format";
import { tempColor, usageBg } from "@/lib/status";
import { cn } from "@/lib/utils";
import { useRingHistory } from "@/hooks/useRingHistory";

export interface WidgetSpec {
  id: string;
  title: string;
  icon: typeof Activity;
  default: { w: number; h: number };
  min: { w: number; h: number };
  render: () => ReactNode;
}

// ── Individual widget components ──────────────────────────────
function CpuW() {
  const { data: sys } = useQuery({ queryKey: ["system"], queryFn: api.system, refetchInterval: 3000 });
  const history = useRingHistory(sys?.cpu, 30);
  return (
    <MetricCard
      orientation="horizontal"
      label="CPU"
      value={percent(sys?.cpu ?? 0)}
      hint={sys?.load?.length ? `load ${sys.load.map((l) => l.toFixed(2)).join(" ")}` : undefined}
      icon={<Cpu className="size-4" />}
      trend={
        <div className="h-full w-full flex items-end">
          <Sparkline data={history} color="var(--chart-1)" width={200} height={64} />
        </div>
      }
    />
  );
}
function MemW() {
  const { data: sys } = useQuery({ queryKey: ["system"], queryFn: api.system, refetchInterval: 3000 });
  const history = useRingHistory(sys?.memory.percent, 30);
  return (
    <MetricCard
      orientation="horizontal"
      label="Memory"
      value={percent(sys?.memory.percent ?? 0)}
      hint={`${bytes(sys?.memory.used ?? 0)} / ${bytes(sys?.memory.total ?? 0)}`}
      icon={<MemoryStick className="size-4" />}
      trend={
        <div className="h-full w-full flex items-end">
          <Sparkline data={history} color="var(--chart-2)" width={200} height={64} />
        </div>
      }
    />
  );
}
function StorageW() {
  const { data: sys } = useQuery({ queryKey: ["system"], queryFn: api.system });
  const totalDrives = sys?.drives.reduce((a, d) => a + (d.total ?? d.size), 0) ?? 0;
  const usedDrives = sys?.drives.reduce((a, d) => a + (d.used ?? 0), 0) ?? 0;
  const pct = totalDrives ? (usedDrives / totalDrives) * 100 : 0;
  return (
    <MetricCard label="Storage" value={percent(pct)} hint={`${bytes(usedDrives)} / ${bytes(totalDrives)}`}
      icon={<HardDrive className="size-4" />} trend={<Progress value={pct} className="h-1.5" />} />
  );
}
function CpuTempW() {
  const { data: sys } = useQuery({ queryKey: ["system"], queryFn: api.system });
  const t = sys?.sensors.cpuTemperature?.value ?? 0;
  return <MetricCard label="CPU Temp" value={<span className={tempColor(t)}>{t.toFixed(1)}°C</span>}
    hint={sys?.sensors.cpuTemperature?.label} icon={<Thermometer className="size-4" />} />;
}
function ServicesW() {
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: api.services, refetchInterval: 3000 });
  const on = services.filter((s) => s.status === "online").length;
  const off = services.filter((s) => s.status === "offline").length;
  const unk = services.filter((s) => s.status === "unknown").length;
  const bad = off + unk;
  return (
    <MetricCard
      label="Services"
      value={`${on}/${services.length}`}
      hint={bad > 0 ? `${bad} offline` : "all online"}
      icon={<Activity className="size-4" />}
    />
  );
}
function LiveTrendW() {
  const { data: sys } = useQuery({ queryKey: ["system"], queryFn: api.system, refetchInterval: 3000 });
  const cpuHistory = useRingHistory(sys?.cpu, 40);
  const memHistory = useRingHistory(sys?.memory.percent, 40);
  const data = cpuHistory.map((cpu, i) => ({ t: i, cpu, mem: memHistory[i] ?? 0 }));
  return (
    <WidgetShell title="Live performance" icon={<Activity className="size-4" />}>
      <div className="h-full w-full">
        <AreaTrend data={data} series={[
          { key: "cpu", color: "var(--chart-1)", name: "CPU %" },
          { key: "mem", color: "var(--chart-2)", name: "Memory %" },
        ]} yDomain={[0, 100]} height="100%" />
      </div>
    </WidgetShell>
  );
}
function SensorsW() {
  const { data: sys } = useQuery({ queryKey: ["system"], queryFn: api.system, refetchInterval: 3000 });
  const temps = sys?.sensors.temperatures ?? [];
  const fans = sys?.sensors.fans ?? [];
  return (
    <WidgetShell title="Sensors" icon={<Thermometer className="size-4" />} scroll>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {temps.map((t) => (
          <div key={t.id} className="flex justify-between gap-2 min-w-0">
            <span className="text-muted-foreground truncate">{t.label}</span>
            <span className={cn("font-mono tabular-nums shrink-0", tempColor(t.value))}>{t.value.toFixed(1)}°</span>
          </div>
        ))}
        {fans.map((f) => (
          <div key={f.id} className="flex justify-between gap-2 min-w-0">
            <span className="text-muted-foreground truncate flex items-center gap-1"><Fan className="size-3 shrink-0" />{f.label}</span>
            <span className="font-mono tabular-nums shrink-0">{Math.round(f.value)}</span>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}
function ProcessesW() {
  const { data: procs = [] } = useQuery({ queryKey: ["processes"], queryFn: api.processes });
  const top = useMemo(() => [...procs].sort((a, b) => b.cpu - a.cpu).slice(0, 6), [procs]);
  return (
    <WidgetShell title="Top processes" icon={<Cpu className="size-4" />} scroll>
      <table className="w-full text-sm">
        <thead><tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
          <th className="text-left py-1 font-medium">PID</th>
          <th className="text-left font-medium">User</th>
          <th className="text-left font-medium">Command</th>
          <th className="text-right font-medium">CPU</th>
          <th className="text-right font-medium">MEM</th>
        </tr></thead>
        <tbody>
          {top.map((p) => (
            <tr key={p.pid} className="border-t">
              <td className="py-1.5 font-mono tabular-nums">{p.pid}</td>
              <td className="truncate max-w-[120px]">{p.user}</td>
              <td className="font-mono text-xs truncate max-w-[220px]">{p.command}</td>
              <td className="text-right tabular-nums">{p.cpu.toFixed(1)}%</td>
              <td className="text-right tabular-nums">{p.mem.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </WidgetShell>
  );
}
function NetworkW() {
  const { data: net } = useQuery({ queryKey: ["network"], queryFn: api.network, refetchInterval: 3000 });
  const rxNow = net?.interfaces.reduce((a, i) => a + i.rxKbps, 0) ?? 0;
  const txNow = net?.interfaces.reduce((a, i) => a + i.txKbps, 0) ?? 0;
  const rxHistory = useRingHistory(rxNow, 40);
  const txHistory = useRingHistory(txNow, 40);
  const data = rxHistory.map((rx, i) => ({ t: i, rx, tx: txHistory[i] ?? 0 }));
  return (
    <WidgetShell title="Network" icon={<Wifi className="size-4" />}>
      <div className="h-full grid grid-cols-[minmax(0,9rem)_1fr] gap-3">
        {/* Left column: Rx/Tx stacked + interface list */}
        <div className="flex flex-col gap-2 min-w-0">
          <div className="rounded-md border p-2 min-w-0">
            <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><ArrowDown className="size-3" /> Rx</p>
            <p className="text-base font-semibold tabular-nums truncate">{kbps(rxNow)}</p>
          </div>
          <div className="rounded-md border p-2 min-w-0">
            <p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><ArrowUp className="size-3" /> Tx</p>
            <p className="text-base font-semibold tabular-nums truncate">{kbps(txNow)}</p>
          </div>
          <div className="flex-1 min-h-0 overflow-auto space-y-1 pt-1">
            {net?.interfaces.map((i) => (
              <div key={i.name} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-mono text-muted-foreground flex items-center gap-1 truncate"><Wifi className="size-3 shrink-0" />{i.name}</span>
                <span className="tabular-nums shrink-0">{kbps(i.rxKbps + i.txKbps)}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Right column: chart fills remaining space */}
        <div className="min-w-0 min-h-0">
          <AreaTrend
            data={data}
            series={[
              { key: "rx", color: "var(--chart-1)", name: "Rx" },
              { key: "tx", color: "var(--chart-2)", name: "Tx" },
            ]}
            height="100%"
          />
        </div>
      </div>
    </WidgetShell>
  );
}
function AlertsW() {
  const { data: alerts = [] } = useQuery({ queryKey: ["alerts", "history"], queryFn: api.alerts.history });
  return (
    <WidgetShell title="Recent alerts" icon={<AlertTriangle className="size-4" />} scroll>
      <div className="space-y-2 text-sm">
        {alerts.slice(0, 6).map((a) => (
          <div key={a.id} className="flex items-start gap-2 border-b last:border-0 pb-2 last:pb-0">
            <Badge variant={a.status === "fired" ? "destructive" : a.status === "resolved" ? "default" : "secondary"} className="text-[10px] uppercase">{a.status}</Badge>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{a.ruleName}</p>
              <p className="text-[10px] text-muted-foreground">{relativeTime(a.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}
function UptimeW() {
  const { data: sys } = useQuery({ queryKey: ["system"], queryFn: api.system });
  return <MetricCard label="Uptime" value={duration(sys?.uptime ?? 0)} icon={<Clock className="size-4" />} />;
}
function DockerW() {
  const { data: containers = [] } = useQuery({ queryKey: ["docker", "containers"], queryFn: api.docker.containers });
  const running = containers.filter((c) => c.state === "running").length;
  return <MetricCard label="Docker" value={`${running}/${containers.length}`} hint="containers running" icon={<Container className="size-4" />} />;
}
function IncusW() {
  const { data: instances = [] } = useQuery({ queryKey: ["incus"], queryFn: api.incus });
  const active = instances.filter((i) => i.status === "active").length;
  return <MetricCard label="Incus" value={`${active}/${instances.length}`} hint="instances active" icon={<Boxes className="size-4" />} />;
}
function DbW() {
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: api.services });
  const dbs = services.filter((s) => s.category === "Database");
  return (
    <WidgetShell title="Databases" icon={<Database className="size-4" />} scroll>
      <div className="space-y-2 text-sm">
        {dbs.map((s) => (
          <div key={s.slug} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0"><span className="size-2 rounded-full shrink-0" style={{ background: s.status === "online" ? "var(--success)" : "var(--destructive)" }} /><span className="truncate">{s.name}</span></span>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">{s.responseTime > 0 ? `${s.responseTime.toFixed(0)} ms` : "—"}</span>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}
function MonW() {
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: api.services });
  const mon = services.filter((s) => s.category === "Monitoring");
  return (
    <WidgetShell title="Monitoring" icon={<BarChart3 className="size-4" />} scroll>
      <div className="space-y-2 text-sm">
        {mon.map((s) => (
          <div key={s.slug} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0"><span className="size-2 rounded-full shrink-0" style={{ background: s.status === "online" ? "var(--success)" : "var(--destructive)" }} /><span className="truncate">{s.name}</span></span>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">{s.responseTime > 0 ? `${s.responseTime.toFixed(0)} ms` : "—"}</span>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}
function DrivesW() {
  const { data: sys } = useQuery({ queryKey: ["system"], queryFn: api.system });
  return (
    <WidgetShell title="Drives" icon={<HardDrive className="size-4" />} scroll>
      <div className="space-y-2">
        {sys?.drives.map((d) => {
          const pct = d.percent ?? (d.total && d.used ? (d.used / d.total) * 100 : 0);
          return (
            <div key={d.name} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono truncate min-w-0">{d.name}</span>
                <span className={cn("tabular-nums shrink-0", pct >= 90 ? "text-destructive" : pct >= 75 ? "text-[var(--warning)]" : "text-muted-foreground")}>
                  {bytes(d.used ?? 0)} / {bytes(d.total ?? d.size)} · {pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full", usageBg(pct))} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

// ── Widget catalog ────────────────────────────────────────────
// Standardized sizing rules (12-col grid, rowHeight 56):
//  - Small stat (single number):  default 2x2,  min 2x2
//  - Wide stat with trend:        default 4x2,  min 4x2
//  - Compact list:                default 4x4,  min 3x3
//  - Charts / detailed lists:     default 6x5,  min 4x4
//  - Wide tables:                 default 8x5,  min 5x4
export const WIDGETS: WidgetSpec[] = [
  { id: "cpu",       title: "CPU",              icon: Cpu,            default: { w: 4, h: 2 }, min: { w: 4, h: 2 }, render: () => <CpuW /> },
  { id: "memory",    title: "Memory",           icon: MemoryStick,    default: { w: 4, h: 2 }, min: { w: 4, h: 2 }, render: () => <MemW /> },
  { id: "storage",   title: "Storage",          icon: HardDrive,      default: { w: 2, h: 2 }, min: { w: 2, h: 2 }, render: () => <StorageW /> },
  { id: "cpu-temp",  title: "CPU Temp",         icon: Thermometer,    default: { w: 2, h: 2 }, min: { w: 2, h: 2 }, render: () => <CpuTempW /> },
  { id: "services",  title: "Services",         icon: Activity,       default: { w: 2, h: 2 }, min: { w: 2, h: 2 }, render: () => <ServicesW /> },
  { id: "uptime",    title: "Uptime",           icon: Clock,          default: { w: 2, h: 2 }, min: { w: 2, h: 2 }, render: () => <UptimeW /> },
  { id: "docker",    title: "Docker",           icon: Container,      default: { w: 2, h: 2 }, min: { w: 2, h: 2 }, render: () => <DockerW /> },
  { id: "incus",     title: "Incus",            icon: Boxes,          default: { w: 2, h: 2 }, min: { w: 2, h: 2 }, render: () => <IncusW /> },
  { id: "live",      title: "Live performance", icon: Activity,       default: { w: 8, h: 5 }, min: { w: 5, h: 4 }, render: () => <LiveTrendW /> },
  { id: "sensors",   title: "Sensors",          icon: Thermometer,    default: { w: 4, h: 2 }, min: { w: 4, h: 2 }, render: () => <SensorsW /> },
  { id: "processes", title: "Top processes",    icon: Cpu,            default: { w: 8, h: 5 }, min: { w: 5, h: 4 }, render: () => <ProcessesW /> },
  { id: "network",   title: "Network",          icon: Wifi,           default: { w: 8, h: 5 }, min: { w: 6, h: 4 }, render: () => <NetworkW /> },
  { id: "alerts",    title: "Recent alerts",    icon: AlertTriangle,  default: { w: 4, h: 4 }, min: { w: 3, h: 3 }, render: () => <AlertsW /> },
  { id: "db",        title: "Databases",        icon: Database,       default: { w: 4, h: 4 }, min: { w: 3, h: 3 }, render: () => <DbW /> },
  { id: "mon",       title: "Monitoring",       icon: BarChart3,      default: { w: 4, h: 4 }, min: { w: 3, h: 3 }, render: () => <MonW /> },
  { id: "drives",    title: "Drives",           icon: HardDrive,      default: { w: 6, h: 4 }, min: { w: 4, h: 3 }, render: () => <DrivesW /> },
];

export const WIDGET_MAP: Record<string, WidgetSpec> = Object.fromEntries(WIDGETS.map((w) => [w.id, w]));

export const DEFAULT_LAYOUT: { i: string; x: number; y: number; w: number; h: number }[] = [
  // Row 1 — primary stats
  { i: "cpu",       x: 0,  y: 0,  w: 4, h: 2 },
  { i: "memory",    x: 4,  y: 0,  w: 4, h: 2 },
  { i: "storage",   x: 8,  y: 0,  w: 2, h: 2 },
  { i: "cpu-temp",  x: 10, y: 0,  w: 2, h: 2 },
  // Row 2 — small stats (all uniform 2x2)
  { i: "uptime",    x: 0,  y: 2,  w: 2, h: 2 },
  { i: "docker",    x: 2,  y: 2,  w: 2, h: 2 },
  { i: "incus",     x: 4,  y: 2,  w: 2, h: 2 },
  { i: "services",  x: 6,  y: 2,  w: 2, h: 2 },
  // Sensors fills remainder of row 2 (4 wide, 2 tall, two-column inside)
  { i: "sensors",   x: 8,  y: 2,  w: 4, h: 2 },
  // Row 3 — charts
  { i: "live",      x: 0,  y: 4,  w: 8, h: 5 },
  { i: "network",   x: 0,  y: 9,  w: 8, h: 5 },
  { i: "alerts",    x: 8,  y: 4,  w: 4, h: 6 },
  // Row 4 — detail
  { i: "processes", x: 0,  y: 14, w: 8, h: 5 },
  { i: "drives",    x: 8,  y: 10, w: 4, h: 5 },
];
