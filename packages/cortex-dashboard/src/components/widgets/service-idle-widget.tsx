"use client";

import { useRef, useState, useEffect } from "react";
import { Server, Activity } from "lucide-react";
import { LiveChart } from "@/components/live-chart";
import { useSystemData, useServicesData } from "@/hooks/use-dashboard-data";
import type { ServiceCheck } from "@/hooks/use-dashboard-data";

export function ServiceIdleWidget() {
	const { data } = useServicesData();
	const services: ServiceCheck[] = data?.services ?? [];
	const idle = services.filter((s) => s.status === "unknown").length;
	return (
		<div className="flex h-full min-h-[80px] items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
			<div className="flex size-10 items-center justify-center rounded-lg bg-muted">
				<Server className="size-5 text-muted-foreground" />
			</div>
			<div>
				<div className="text-2xl font-bold text-foreground">{idle}</div>
				<div className="text-xs text-muted-foreground">Idle</div>
			</div>
		</div>
	);
}

interface ChartPoint {
	time: string;
	cpu: number;
	mem: number;
}

export function LivePerformanceWidget() {
	const { data: sys } = useSystemData();
	const historyRef = useRef<ChartPoint[]>([]);
	const [history, setHistory] = useState<ChartPoint[]>([]);

	useEffect(() => {
		if (sys) {
			const now = new Date();
			const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
			historyRef.current = [
				...historyRef.current.slice(-59),
				{ time, cpu: sys.cpu, mem: sys.memory.percent },
			];
			setHistory(historyRef.current);
		}
	}, [sys]);

	return (
		<div className="h-full flex flex-col min-h-[200px]">
			<div className="flex items-center justify-between mb-4">
				<h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
					<Activity className="size-4 text-primary" />
					Live Performance
				</h2>
				<div className="flex gap-3 text-xs text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<span className="size-2.5 rounded-full bg-chart-1" />
						CPU
					</span>
					<span className="flex items-center gap-1.5">
						<span className="size-2.5 rounded-full bg-chart-2" />
						Mem
					</span>
				</div>
			</div>
			<div className="flex-1 min-h-0">
				<LiveChart
					data={history.length ? history : Array(20).fill({ time: "", cpu: 0, mem: 0 })}
				/>
			</div>
		</div>
	);
}
