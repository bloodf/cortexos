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
		<div className="h-full flex items-center gap-3 border border-white/10 light:border-slate-200 rounded-xl px-4 py-3 bg-white/[0.01] min-h-[80px]">
			<div className="w-10 h-10 rounded-lg bg-white/5 light:bg-slate-100 flex items-center justify-center">
				<Server className="w-5 h-5 text-white/40 light:text-slate-700" />
			</div>
			<div>
				<div className="text-2xl font-bold text-white/60 light:text-slate-700">{idle}</div>
				<div className="text-xs text-white/40 light:text-slate-700">Idle</div>
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
				<h2 className="text-sm font-semibold text-white/80 light:text-slate-700 flex items-center gap-2">
					<Activity className="w-4 h-4 text-indigo-400" />
					Live Performance
				</h2>
				<div className="flex gap-3 text-xs">
					<span className="flex items-center gap-1.5">
						<span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
						CPU
					</span>
					<span className="flex items-center gap-1.5">
						<span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
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
