import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogViewer } from "@/components/LogViewer";
import { KeyValueList } from "@/components/KeyValueList";
import { Sparkline } from "@/components/Sparkline";
import { Card } from "@/components/ui/card";

export interface DetailTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  tabs: DetailTab[];
  actions?: ReactNode;
}

export function DetailDrawer({ open, onOpenChange, title, description, tabs, actions }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center justify-between gap-3">
            <span className="truncate">{title}</span>
            {actions && <span className="flex gap-1 shrink-0">{actions}</span>}
          </SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <Tabs defaultValue={tabs[0]?.id} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="mx-6 mt-3 w-fit">
            {tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {tabs.map((t) => (
              <TabsContent key={t.id} value={t.id} className="mt-0 space-y-4">
                {t.content}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

/** Helper: generate mock log lines for a target. */
function randMsg() {
  const msgs = [
    "request handled in 12ms",
    "connection accepted from 10.0.0.42",
    "cache hit ratio 94.2%",
    "health probe ok",
    "config reloaded",
    "queue depth 3",
    "TLS handshake complete",
    "GET /api/status 200 4ms",
    "background flush 128KiB",
    "worker idle",
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

export function MockLogs({ name, lines = 60 }: { name: string; lines?: number }) {
  const out: string[] = [];
  const now = Date.now();
  for (let i = lines; i > 0; i--) {
    const ts = new Date(now - i * 1500).toISOString().slice(11, 23);
    const r = Math.random();
    let lvl: string;
    if (r < 0.05) lvl = "ERROR";
    else if (r < 0.15) lvl = "WARN";
    else lvl = "INFO";
    out.push(`${ts} ${lvl.padEnd(5)} ${name}: ${randMsg()}`);
  }
  return <LogViewer lines={out} />;
}

function MetricSparkCard({
  label,
  data,
  unit,
  color,
}: {
  label: string;
  data: number[];
  unit: string;
  color: string;
}) {
  const last = data[data.length - 1];
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums mt-1">
        {last.toFixed(0)}
        {unit}
      </div>
      <div className="h-8 mt-1">
        <Sparkline data={data} color={color} />
      </div>
    </Card>
  );
}

export function MockMetrics() {
  const cpu = Array.from({ length: 30 }, () => 20 + Math.random() * 60);
  const mem = Array.from({ length: 30 }, () => 30 + Math.random() * 40);
  const lat = Array.from({ length: 30 }, () => 20 + Math.random() * 120);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <MetricSparkCard label="CPU" data={cpu} unit="%" color="var(--chart-1)" />
      <MetricSparkCard label="Memory" data={mem} unit="%" color="var(--chart-2)" />
      <MetricSparkCard label="Latency p95" data={lat} unit="ms" color="var(--chart-3)" />
    </div>
  );
}

export function MockEnv({ keys }: { keys: string[] }) {
  const items = keys.map((k) => ({ key: k, value: "••••••••••••" }));
  return <KeyValueList items={items} />;
}
