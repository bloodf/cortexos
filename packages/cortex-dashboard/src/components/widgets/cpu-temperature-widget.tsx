"use client";

import { Thermometer } from "lucide-react";
import { useSystemData } from "@/hooks/use-dashboard-data";

function tempColor(value: number) {
	if (value >= 85) return "text-destructive";
	if (value >= 70) return "text-warning";
	return "text-success";
}

export function CpuTemperatureWidget() {
	const { data: sys } = useSystemData();
	const sensor = sys?.sensors?.cpuTemperature;

	return (
		<div className="flex h-full min-h-[200px] flex-col p-1">
			<div className="flex items-center justify-between">
				<div>
					<p className="text-sm font-semibold text-foreground">CPU Temp</p>
					<p className="mt-1 text-xs text-muted-foreground">{sensor?.label ?? "No sensor"}</p>
				</div>
				<div className="rounded-lg bg-muted p-2 text-muted-foreground">
					<Thermometer className="h-5 w-5" />
				</div>
			</div>
			<div className="mt-8 flex items-end gap-2">
				{!sys ? (
					<div className="h-12 w-32 animate-pulse rounded-lg bg-muted" />
				) : sensor ? (
					<>
						<span className={`text-5xl font-bold tabular-nums ${tempColor(sensor.value)}`}>
							{sensor.value.toFixed(1)}
						</span>
						<span className="pb-2 text-lg font-semibold text-muted-foreground">&deg;C</span>
					</>
				) : (
					<span className="text-sm text-muted-foreground">Temperature telemetry unavailable</span>
				)}
			</div>
		</div>
	);
}
