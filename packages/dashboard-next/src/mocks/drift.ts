import type { QueryClient } from "@tanstack/react-query";
import { initialSystem, initialProcesses, initialNetwork, SERVICES, ALERT_HISTORY } from "./seed";
import type { SystemData, ProcessInfo, NetworkData, AlertHistory, Service } from "./types";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const systemState: SystemData = structuredClone(initialSystem);
let procState: ProcessInfo[] = structuredClone(initialProcesses);
let netState: NetworkData = structuredClone(initialNetwork);
let serviceState: Service[] = structuredClone(SERVICES);
let alertState: AlertHistory[] = structuredClone(ALERT_HISTORY);

const cpuHistory: { t: number; cpu: number; mem: number }[] = [];
const HISTORY = 60;

let started = false;
let qc: QueryClient | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  // CPU drift
  systemState.cpu = clamp(systemState.cpu + (Math.random() - 0.5) * 12, 4, 96);
  // Memory drift
  const memP = clamp(systemState.memory.percent + (Math.random() - 0.5) * 4, 25, 92);
  systemState.memory = {
    percent: memP,
    total: systemState.memory.total,
    used: Math.round(systemState.memory.total * (memP / 100)),
  };
  // Sensor drift
  if (systemState.sensors.cpuTemperature) {
    systemState.sensors.cpuTemperature.value = clamp(
      systemState.sensors.cpuTemperature.value + (Math.random() - 0.5) * 4,
      38,
      92,
    );
  }
  systemState.sensors.temperatures = systemState.sensors.temperatures.map((t) => ({
    ...t,
    value: clamp(t.value + (Math.random() - 0.5) * 4, 32, 92),
  }));
  systemState.sensors.fans = systemState.sensors.fans.map((f) => ({
    ...f,
    value: clamp(f.value + (Math.random() - 0.5) * 200, 600, 3200),
  }));
  systemState.sensors.voltages = systemState.sensors.voltages.map((v) => ({
    ...v,
    value: +(v.value + (Math.random() - 0.5) * 0.05).toFixed(2),
  }));
  systemState.load = systemState.load.map((l) => clamp(l + (Math.random() - 0.5) * 0.2, 0.05, 8));
  systemState.uptime += 3;

  cpuHistory.push({ t: Date.now(), cpu: systemState.cpu, mem: memP });
  if (cpuHistory.length > HISTORY) cpuHistory.shift();

  // Processes drift
  procState = procState.map((p) => ({
    ...p,
    cpu: clamp(p.cpu + (Math.random() - 0.5) * 6, 0, 99),
    mem: clamp(p.mem + (Math.random() - 0.5) * 1.2, 0, 99),
  }));

  // Network drift
  netState = {
    interfaces: netState.interfaces.map((i) => {
      const rx = clamp(i.rxKbps + (Math.random() - 0.5) * 600, 30, 9500);
      const tx = clamp(i.txKbps + (Math.random() - 0.5) * 400, 30, 6000);
      return {
        ...i,
        rxKbps: rx,
        txKbps: tx,
        rxBytesTotal: i.rxBytesTotal + rx * 128 * 3,
        txBytesTotal: i.txBytesTotal + tx * 128 * 3,
      };
    }),
  };

  // Occasional service flip
  if (Math.random() < 0.06) {
    const idx = Math.floor(Math.random() * serviceState.length);
    const cur = serviceState[idx];
    const flipped: typeof cur.status = cur.status === "online" ? "offline" : "online";
    serviceState = serviceState.map((s, i) =>
      i === idx
        ? {
            ...s,
            status: flipped,
            responseTime: flipped === "online" ? 30 + Math.random() * 80 : 0,
          }
        : s,
    );
    alertState = [
      {
        id: `live-${Date.now()}`,
        ruleName: `${cur.name} state change`,
        serviceName: cur.name,
        status: (flipped === "online" ? "resolved" : "fired") as "resolved" | "fired",
        message: flipped === "online" ? "Recovered" : "Health check failed",
        timestamp: new Date().toISOString(),
      },
      ...alertState,
    ].slice(0, 80);
  } else {
    // Subtle latency drift on online services
    serviceState = serviceState.map((s) =>
      s.status === "online"
        ? { ...s, responseTime: clamp(s.responseTime + (Math.random() - 0.5) * 14, 8, 480) }
        : s,
    );
  }

  if (qc) {
    qc.setQueryData(["system"], { ...systemState });
    qc.setQueryData(["processes"], [...procState]);
    qc.setQueryData(["network"], { ...netState });
    qc.setQueryData(["services"], [...serviceState]);
    qc.setQueryData(["history"], [...cpuHistory]);
    qc.setQueryData(["alerts", "history"], [...alertState]);
  }
}

export function startDrift(client: QueryClient) {
  qc = client;
  if (started) return;
  started = true;
  // Seed initial history so charts have data immediately
  const t0 = Date.now();
  for (let i = HISTORY; i > 0; i--) {
    cpuHistory.push({
      t: t0 - i * 3000,
      cpu: clamp(systemState.cpu + (Math.random() - 0.5) * 10, 10, 80),
      mem: clamp(systemState.memory.percent + (Math.random() - 0.5) * 6, 25, 85),
    });
  }
  qc.setQueryData(["history"], [...cpuHistory]);
  timer = setInterval(tick, 3000);
}

export function stopDrift() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  started = false;
}

export const live = {
  system: () => systemState,
  processes: () => procState,
  network: () => netState,
  services: () => serviceState,
  history: () => cpuHistory,
  alerts: () => alertState,
  /** Force-flip a service for outage simulation. */
  flipService(slug: string, status: "online" | "offline") {
    serviceState = serviceState.map((s) =>
      s.slug === slug ? { ...s, status, responseTime: status === "online" ? 40 : 0 } : s,
    );
    const svc = serviceState.find((s) => s.slug === slug);
    if (svc) {
      alertState = [
        {
          id: `sim-${Date.now()}`,
          ruleName: `${svc.name} simulated`,
          serviceName: svc.name,
          status: (status === "online" ? "resolved" : "fired") as AlertHistory["status"],
          message: status === "online" ? "Simulated recovery" : "Simulated outage",
          timestamp: new Date().toISOString(),
        },
        ...alertState,
      ].slice(0, 80);
    }
    if (qc) {
      qc.setQueryData(["services"], [...serviceState]);
      qc.setQueryData(["alerts", "history"], [...alertState]);
    }
  },
  /** Crash a random online service. */
  crashRandom() {
    const online = serviceState.filter((s) => s.status === "online");
    if (online.length === 0) return null;
    const target = online[Math.floor(Math.random() * online.length)];
    this.flipService(target.slug, "offline");
    return target;
  },
  /** Mark all services online. */
  healAll() {
    serviceState = serviceState.map((s) => ({ ...s, status: "online" as const, responseTime: 40 }));
    if (qc) qc.setQueryData(["services"], [...serviceState]);
  },
};
