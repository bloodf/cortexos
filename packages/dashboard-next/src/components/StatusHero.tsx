import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, XCircle, type LucideIcon } from "lucide-react";
import { api } from "@/mocks/api";
import { cn } from "@/lib/utils";

/**
 * Top-of-page system health banner. Aggregates services + CPU + memory into
 * one calm sentence ("All systems operational", "1 service degraded", ...).
 */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wide opacity-60">{label}</div>
      <div className="font-mono font-medium">{value}</div>
    </div>
  );
}

export function StatusHero({ className }: { className?: string }) {
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: api.services });
  const { data: system } = useQuery({ queryKey: ["system"], queryFn: api.system });

  const down = services.filter((s) => s.status === "offline").length;
  const total = services.length;
  const cpu = system?.cpu ?? 0;
  const mem = system?.memory.percent ?? 0;

  let level: "ok" | "warn" | "down" = "ok";
  let label = "All systems operational";
  let detail = `${total} services online · CPU ${Math.round(cpu)}% · Mem ${Math.round(mem)}%`;

  if (down > 0) {
    level = "down";
    label = `${down} service${down > 1 ? "s" : ""} offline`;
    detail = `${total - down} of ${total} healthy · CPU ${Math.round(cpu)}% · Mem ${Math.round(mem)}%`;
  } else if (cpu > 85 || mem > 88) {
    level = "warn";
    label = "Elevated load";
    detail = `CPU ${Math.round(cpu)}% · Mem ${Math.round(mem)}% · ${total} services online`;
  }

  let Icon: LucideIcon;
  if (level === "ok") Icon = CheckCircle2;
  else if (level === "warn") Icon = AlertTriangle;
  else Icon = XCircle;
  const tone = {
    ok: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30",
    warn: "bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/40",
    down: "bg-destructive/10 text-destructive border-destructive/40",
  }[level];

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      <div className={cn("flex items-center gap-3 px-4 py-3 border-b", tone)}>
        <Icon className="size-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium leading-none">{label}</p>
          <p className="mt-1 text-xs opacity-80">{detail}</p>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-3 text-xs">
          <Stat label="Services" value={`${total - down}/${total}`} />
          <Stat label="CPU" value={`${Math.round(cpu)}%`} />
          <Stat label="Memory" value={`${Math.round(mem)}%`} />
        </div>
      </div>
    </div>
  );
}
