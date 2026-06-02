"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, Cpu, MemoryStick, HardDrive, Thermometer, AlertTriangle,
  Container, ArrowDown, ArrowUp, Clock, Database, BarChart3, Wifi, Boxes,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/components/sys-pilot/MetricCard";
import { GaugeRadial } from "@/components/sys-pilot/GaugeRadial";
import { Sparkline } from "@/components/sys-pilot/Sparkline";
import { AreaTrend } from "@/components/sys-pilot/AreaTrend";
import { api } from "@/lib/api";
import { bytes, kbps, duration, percent, relativeTime } from "@/lib/sys-pilot/format";
import { tempColor, usageBg } from "@/lib/sys-pilot/status";
import { cn } from "@/lib/utils";

export interface WidgetSpec {
  id: string;
  title: string;
  icon: typeof Activity;
  default: { w: number; h: number };
  min: { w: number; h: number };
  render: () => ReactNode;
}

// ── Rolling performance history ───────────────────────────────
// The backend exposes only a point-in-time snapshot (/api/system); there is no
// time-series endpoint. We accumulate REAL samples client-side into a shared
// ring buffer so the sparklines / live chart render actual CPU & memory history.
type HistPoint = { t: number; cpu: number; mem: number };
const HISTORY_LIMIT = 60;
const historyBuffer: HistPoint[] = [];

function pushHistory(cpu: number, mem: number): HistPoint[] {
  historyBuffer.push({ t: Date.now(), cpu, mem });
  if (historyBuffer.length > HISTORY_LIMIT) historyBuffer.splice(0, historyBuffer.length - HISTORY_LIMIT);
  return historyBuffer.slice();
}

/**
 * Samples the real /api/system snapshot on an interval and returns the
 * accumulated CPU/memory history. Shared across the CPU, Memory and Live
 * performance widgets via the "history" query key.
 */
function useHistory() {
  return useQuery<HistPoint[]>({
    queryKey: ["history"],
    queryFn: async () => {
      const sys = await api.system();
      return pushHistory(sys.cpu ?? 0, sys.memory?.percent ?? 0);
    },
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
}

// ── Individual widget components ──────────────────────────────
function CpuW() {
  const { data: sys } = useQuery({ queryKey: ["system"], queryFn: api.system });
  const { data: hist = [] } = useHistory();
  return (
    <MetricCard label="CPU" value={percent(sys?.cpu ?? 0)} icon={<Cpu className="size-4" />}
      trend={<Sparkline data={hist.map((h) => h.cpu)} color="var(--chart-1)" />} />
  );
}
function MemW() {
  const { data: sys } = useQuery({ queryKey: ["system"], queryFn: api.system });
  const { data: hist = [] } = useHistory();
  return (
    <MetricCard label="Memory" value={percent(sys?.memory.percent ?? 0)}
      hint={`${bytes(sys?.memory.used ?? 0)} / ${bytes(sys?.memory.total ?? 0)}`}
      icon={<MemoryStick className="size-4" />}
      trend={<Sparkline data={hist.map((h) => h.mem)} color="var(--chart-2)" />} />
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
function ServicesOnW() {
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: api.services });
  const on = services.filter((s) => s.status === "online").length;
  return <MetricCard label="Services online" value={on} hint={`of ${services.length}`}
    icon={<Activity className="size-4 text-[var(--success)]" />} />;
}
function ServicesOffW() {
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: api.services });
  const off = services.filter((s) => s.status === "offline").length;
  const unk = services.filter((s) => s.status === "unknown").length;
  return <MetricCard label="Services offline" value={off + unk} hint={`${off} down · ${unk} unknown`}
    icon={<AlertTriangle className="size-4 text-[var(--destructive)]" />} />;
}
function LiveTrendW() {
  const { data: hist = [] } = useHistory();
  return (
    <Card className="elev-1 h-full flex flex-col">
      <CardHeader className="pb-2"><CardTitle className="text-sm">Live performance</CardTitle></CardHeader>
      <CardContent className="flex-1 min-h-0">
        <AreaTrend data={hist} series={[
          { key: "cpu", color: "var(--chart-1)", name: "CPU %" },
          { key: "mem", color: "var(--chart-2)", name: "Memory %" },
        ]} yDomain={[0, 100]} height={200} />
      </CardContent>
    </Card>
  );
}
function SensorsW() {
  const { data: sys } = useQuery({ queryKey: ["system"], queryFn: api.system });
  const cpuTemp = sys?.sensors.cpuTemperature?.value ?? 0;
  return (
    <Card className="elev-1 h-full">
      <CardHeader className="pb-2"><CardTitle className="text-sm">Sensors</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col items-center"><GaugeRadial value={cpuTemp} max={100} size={100}
          label={`${cpuTemp.toFixed(0)}°`} sublabel="CPU" thresholds={[70, 85]} /></div>
        <div className="space-y-2">
          {sys?.sensors.fans.slice(0, 3).map((f) => (
            <div key={f.id} className="flex justify-between"><span className="text-muted-foreground">{f.label}</span>
              <span className="font-mono tabular-nums">{Math.round(f.value)} rpm</span></div>
          ))}
          {sys?.sensors.voltages.slice(0, 2).map((v) => (
            <div key={v.id} className="flex justify-between"><span className="text-muted-foreground">{v.label}</span>
              <span className="font-mono tabular-nums">{v.value.toFixed(2)} V</span></div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
function ProcessesW() {
  const { data: procs = [] } = useQuery({ queryKey: ["processes"], queryFn: api.processes });
  const top = useMemo(() => procs.toSorted((a, b) => b.cpu - a.cpu).slice(0, 6), [procs]);
  return (
    <Card className="elev-1 h-full">
      <CardHeader className="pb-2"><CardTitle className="text-sm">Top processes</CardTitle></CardHeader>
      <CardContent className="overflow-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs uppercase tracking-wide text-muted-foreground">
            <th className="text-left py-1">PID</th><th className="text-left">User</th>
            <th className="text-left">Command</th><th className="text-right">CPU</th><th className="text-right">MEM</th>
          </tr></thead>
          <tbody>
            {top.map((p) => (
              <tr key={p.pid} className="border-t">
                <td className="py-1.5 font-mono tabular-nums">{p.pid}</td>
                <td>{p.user}</td>
                <td className="font-mono text-xs truncate max-w-[220px]">{p.command}</td>
                <td className="text-right tabular-nums">{p.cpu.toFixed(1)}%</td>
                <td className="text-right tabular-nums">{p.mem.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
function NetworkW() {
  const { data: net } = useQuery({ queryKey: ["network"], queryFn: api.network });
  const rxNow = net?.interfaces.reduce((a, i) => a + i.rxKbps, 0) ?? 0;
  const txNow = net?.interfaces.reduce((a, i) => a + i.txKbps, 0) ?? 0;
  return (
    <Card className="elev-1 h-full">
      <CardHeader className="pb-2"><CardTitle className="text-sm">Network</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border p-2"><p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><ArrowDown className="size-3" /> Rx</p>
            <p className="text-lg font-semibold tabular-nums">{kbps(rxNow)}</p></div>
          <div className="rounded-md border p-2"><p className="text-[10px] uppercase text-muted-foreground flex items-center gap-1"><ArrowUp className="size-3" /> Tx</p>
            <p className="text-lg font-semibold tabular-nums">{kbps(txNow)}</p></div>
        </div>
        <div className="space-y-1.5">
          {net?.interfaces.map((i) => (
            <div key={i.name} className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted-foreground flex items-center gap-1"><Wifi className="size-3" />{i.name}</span>
              <span className="tabular-nums">{kbps(i.rxKbps + i.txKbps)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
function AlertsW() {
  const { data: alerts = [] } = useQuery({ queryKey: ["alerts", "history"], queryFn: api.alerts.history });
  return (
    <Card className="elev-1 h-full">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="size-4" />Recent alerts</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm overflow-auto">
        {alerts.slice(0, 6).map((a) => (
          <div key={a.id} className="flex items-start gap-2 border-b last:border-0 pb-2 last:pb-0">
            <Badge variant={a.status === "fired" ? "destructive" : a.status === "resolved" ? "default" : "secondary"} className="text-[10px] uppercase">{a.status}</Badge>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{a.ruleName}</p>
              <p className="text-[10px] text-muted-foreground">{relativeTime(a.timestamp)}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
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
  const { data: instances = [] } = useQuery({ queryKey: ["incus"], queryFn: api.incus.instances });
  const active = instances.filter((i) => i.status === "active").length;
  return <MetricCard label="Incus" value={`${active}/${instances.length}`} hint="instances active" icon={<Boxes className="size-4" />} />;
}
function DbW() {
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: api.services });
  const dbs = services.filter((s) => s.category === "Database");
  return (
    <Card className="elev-1 h-full">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Database className="size-4" />Databases</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm overflow-auto">
        {dbs.map((s) => (
          <div key={s.slug} className="flex items-center justify-between">
            <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: s.status === "online" ? "var(--success)" : "var(--destructive)" }} />{s.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{s.responseTime > 0 ? `${s.responseTime.toFixed(0)} ms` : "—"}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
function MonW() {
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: api.services });
  const mon = services.filter((s) => s.category === "Monitoring");
  return (
    <Card className="elev-1 h-full">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="size-4" />Monitoring</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm overflow-auto">
        {mon.map((s) => (
          <div key={s.slug} className="flex items-center justify-between">
            <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: s.status === "online" ? "var(--success)" : "var(--destructive)" }} />{s.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{s.responseTime > 0 ? `${s.responseTime.toFixed(0)} ms` : "—"}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
function DrivesW() {
  const { data: sys } = useQuery({ queryKey: ["system"], queryFn: api.system });
  return (
    <Card className="elev-1 h-full">
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><HardDrive className="size-4" />Drives & Mounts</CardTitle></CardHeader>
      <CardContent className="overflow-auto">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sys?.drives.map((d) => {
            const pct = d.percent ?? (d.total && d.used ? (d.used / d.total) * 100 : 0);
            return (
              <div key={d.name} className="rounded-md border p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-mono">{d.name}</span>
                  <span className="text-muted-foreground">{d.type ?? "—"}</span>
                </div>
                <p className="text-sm font-medium truncate" title={d.model}>{d.model}</p>
                <div className="flex justify-between text-xs tabular-nums">
                  <span>{bytes(d.used ?? 0)} / {bytes(d.total ?? d.size)}</span>
                  <span className={cn(pct >= 90 ? "text-destructive" : pct >= 75 ? "text-[var(--warning)]" : "text-muted-foreground")}>{pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full", usageBg(pct))} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export const WIDGETS: WidgetSpec[] = [
  { id: "cpu", title: "CPU", icon: Cpu, default: { w: 2, h: 2 }, min: { w: 2, h: 2 }, render: () => <CpuW /> },
  { id: "memory", title: "Memory", icon: MemoryStick, default: { w: 2, h: 2 }, min: { w: 2, h: 2 }, render: () => <MemW /> },
  { id: "storage", title: "Storage", icon: HardDrive, default: { w: 2, h: 2 }, min: { w: 2, h: 2 }, render: () => <StorageW /> },
  { id: "cpu-temp", title: "CPU Temp", icon: Thermometer, default: { w: 2, h: 2 }, min: { w: 2, h: 2 }, render: () => <CpuTempW /> },
  { id: "svc-on", title: "Services online", icon: Activity, default: { w: 2, h: 2 }, min: { w: 2, h: 2 }, render: () => <ServicesOnW /> },
  { id: "svc-off", title: "Services offline", icon: AlertTriangle, default: { w: 2, h: 2 }, min: { w: 2, h: 2 }, render: () => <ServicesOffW /> },
  { id: "live", title: "Live performance", icon: Activity, default: { w: 8, h: 5 }, min: { w: 4, h: 4 }, render: () => <LiveTrendW /> },
  { id: "sensors", title: "Sensors", icon: Thermometer, default: { w: 4, h: 5 }, min: { w: 3, h: 4 }, render: () => <SensorsW /> },
  { id: "processes", title: "Top processes", icon: Cpu, default: { w: 8, h: 5 }, min: { w: 4, h: 4 }, render: () => <ProcessesW /> },
  { id: "network", title: "Network", icon: Wifi, default: { w: 4, h: 5 }, min: { w: 3, h: 4 }, render: () => <NetworkW /> },
  { id: "uptime", title: "Uptime", icon: Clock, default: { w: 3, h: 2 }, min: { w: 2, h: 2 }, render: () => <UptimeW /> },
  { id: "docker", title: "Docker", icon: Container, default: { w: 3, h: 2 }, min: { w: 2, h: 2 }, render: () => <DockerW /> },
  { id: "incus", title: "Incus", icon: Boxes, default: { w: 3, h: 2 }, min: { w: 2, h: 2 }, render: () => <IncusW /> },
  { id: "alerts", title: "Recent alerts", icon: AlertTriangle, default: { w: 4, h: 5 }, min: { w: 3, h: 4 }, render: () => <AlertsW /> },
  { id: "db", title: "Databases", icon: Database, default: { w: 4, h: 4 }, min: { w: 3, h: 3 }, render: () => <DbW /> },
  { id: "mon", title: "Monitoring", icon: BarChart3, default: { w: 4, h: 4 }, min: { w: 3, h: 3 }, render: () => <MonW /> },
  { id: "drives", title: "Drives & Mounts", icon: HardDrive, default: { w: 12, h: 4 }, min: { w: 6, h: 3 }, render: () => <DrivesW /> },
];

export const WIDGET_MAP: Record<string, WidgetSpec> = Object.fromEntries(WIDGETS.map((w) => [w.id, w]));

export const DEFAULT_LAYOUT: { i: string; x: number; y: number; w: number; h: number }[] = [
  { i: "cpu",       x: 0,  y: 0,  w: 2, h: 2 },
  { i: "memory",    x: 2,  y: 0,  w: 2, h: 2 },
  { i: "storage",   x: 4,  y: 0,  w: 2, h: 2 },
  { i: "cpu-temp",  x: 6,  y: 0,  w: 2, h: 2 },
  { i: "svc-on",    x: 8,  y: 0,  w: 2, h: 2 },
  { i: "svc-off",   x: 10, y: 0,  w: 2, h: 2 },
  { i: "live",      x: 0,  y: 2,  w: 8, h: 5 },
  { i: "sensors",   x: 8,  y: 2,  w: 4, h: 5 },
  { i: "processes", x: 0,  y: 7,  w: 8, h: 5 },
  { i: "network",   x: 8,  y: 7,  w: 4, h: 5 },
  { i: "uptime",    x: 0,  y: 12, w: 3, h: 2 },
  { i: "docker",    x: 3,  y: 12, w: 3, h: 2 },
  { i: "incus",     x: 6,  y: 12, w: 3, h: 2 },
  { i: "alerts",    x: 9,  y: 12, w: 3, h: 4 },
  { i: "drives",    x: 0,  y: 14, w: 12, h: 4 },
];
