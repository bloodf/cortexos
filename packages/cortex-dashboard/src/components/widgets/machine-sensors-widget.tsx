"use client";

import { Activity, Fan, Gauge, Thermometer, Zap } from "lucide-react";
import { useSystemData } from "@/hooks/use-dashboard-data";
import type { MachineSensor } from "@/hooks/use-dashboard-data";

function formatSensor(sensor: MachineSensor) {
	if (sensor.unit === "celsius") return `${sensor.value.toFixed(1)} C`;
	if (sensor.unit === "rpm") return `${Math.round(sensor.value)} rpm`;
	return `${sensor.value.toFixed(2)} V`;
}

function SensorRow({ sensor }: { sensor: MachineSensor }) {
	const Icon = sensor.unit === "celsius" ? Thermometer : sensor.unit === "rpm" ? Fan : Zap;
	return (
		<div className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2 light:bg-slate-100">
			<div className="flex min-w-0 items-center gap-2">
				<Icon className="h-4 w-4 shrink-0 text-white/40 light:text-slate-500" />
				<div className="min-w-0">
					<p className="truncate text-sm font-medium text-white/80 light:text-slate-800">{sensor.label}</p>
					<p className="truncate text-xs text-white/35 light:text-slate-500">{sensor.source}</p>
				</div>
			</div>
			<span className="shrink-0 text-sm font-semibold tabular-nums text-white/70 light:text-slate-700">
				{formatSensor(sensor)}
			</span>
		</div>
	);
}

export function MachineSensorsWidget() {
	const { data: sys } = useSystemData();
	const sensors = [
		...(sys?.sensors?.temperatures ?? []).slice(0, 4),
		...(sys?.sensors?.fans ?? []).slice(0, 2),
		...(sys?.sensors?.voltages ?? []).slice(0, 2),
	].slice(0, 8);

	return (
		<div className="h-full min-h-[260px] p-1">
			<div className="mb-4 flex items-center justify-between">
				<div>
					<p className="text-sm font-semibold text-white/80 light:text-slate-800">Machine Sensors</p>
					<p className="mt-1 text-xs text-white/40 light:text-slate-500">Thermals, fans, and voltage rails</p>
				</div>
				<Gauge className="h-5 w-5 text-white/40 light:text-slate-500" />
			</div>
			{sys ? (
				sensors.length ? (
					<div className="space-y-2">
						{sensors.map((sensor) => (
							<SensorRow key={sensor.id} sensor={sensor} />
						))}
					</div>
				) : (
					<div className="flex h-36 flex-col items-center justify-center text-center text-sm text-white/40 light:text-slate-500">
						<Activity className="mb-2 h-5 w-5" />
						No machine sensors exposed by the host
					</div>
				)
			) : (
				<div className="space-y-2">
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="h-10 animate-pulse rounded-lg bg-white/[0.04] light:bg-slate-100" />
					))}
				</div>
			)}
		</div>
	);
}
