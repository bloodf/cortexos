"use client";

import { Network as NetIcon, ArrowDown, ArrowUp } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { MetricCard } from "@/components/sys-pilot/MetricCard";
import { NetworkTopology } from "@/components/sys-pilot/NetworkTopology";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

import { useQuery } from "@tanstack/react-query";
import type { NetworkData, NetworkInterface } from "@/lib/types";
import { bytes, kbps } from "@/lib/sys-pilot/format";

export default function NetworkPage() {
  const { data: net } = useQuery<NetworkData>({ queryKey: ["network"], queryFn: api.network, refetchInterval: 3000 });
  const interfaces: NetworkInterface[] = net?.interfaces ?? [];
  const totalRx = interfaces.reduce((a, i) => a + (i.rxKbps ?? 0), 0);
  const totalTx = interfaces.reduce((a, i) => a + (i.txKbps ?? 0), 0);
  return (
    <div className="space-y-5">
      <PageHeader icon={<NetIcon className="size-5" />} title={"Network"} description={`${interfaces.length} interfaces`} />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <MetricCard label="Rx Total" value={kbps(totalRx)} icon={<ArrowDown className="size-4" />} />
        <MetricCard label="Tx Total" value={kbps(totalTx)} icon={<ArrowUp className="size-4" />} />
        <MetricCard label="Lifetime Rx" value={bytes(interfaces.reduce((a, i) => a + (i.rxBytesTotal ?? 0), 0))} />
        <MetricCard label="Lifetime Tx" value={bytes(interfaces.reduce((a, i) => a + (i.txBytesTotal ?? 0), 0))} />
      </div>
      <NetworkTopology />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {interfaces.map((i) => (
          <Card key={i.name} className="elev-1">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-mono">{i.name}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Rx</span><span className="tabular-nums">{kbps(i.rxKbps)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tx</span><span className="tabular-nums">{kbps(i.txKbps)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rx total</span><span className="tabular-nums text-xs">{bytes(i.rxBytesTotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tx total</span><span className="tabular-nums text-xs">{bytes(i.txBytesTotal)}</span></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
