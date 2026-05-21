"use client";

import { Thermometer } from "lucide-react";
import { useSystemData } from "@/hooks/use-dashboard-data";

function tempColor(value: number) {
	if (value >= 85) return "text-red-400";
	if (value >= 70) return "text-amber-400";
	return "text-emerald-400";
}

export function CpuTemperatureWidget() {
	const { data: sys } = useSystemData();
	const sensor = sys?.sensors?.cpuTemperature;

	return (
		<div className="h-full min-h-[200px] p-1">
			<div className="flex items-center justify-between">
				<div>
					<p className="text-sm font-semibold text-white/80 light:text-slate-800">CPU Temp</p>
					<p className="mt-1 text-xs text-white/40 light:text-slate-500">{sensor?.label ?? "No sensor"}</p>
				</div>
				<div className="rounded-lg bg-white/[0.06] p-2 text-white/50 light:bg-slate-100 light:text-slate-600">
					<Thermometer className="h-5 w-5" />
				</div>
			</div>
			<div className="mt-8 flex items-end gap-2">
				{sensor ? (
					<>
						<span className={`text-5xl font-bold tabular-nums ${tempColor(sensor.value)}`}>
							{sensor.value.toFixed(1)}
						</span>
						<span className="pb-2 text-lg font-semibold text-white/40 light:text-slate-500">C</span>
					</>
				) : (
					<span className="text-sm text-white/40 light:text-slate-500">Temperature telemetry unavailable</span>
				)}
			</div>
		</div>
	);
}
