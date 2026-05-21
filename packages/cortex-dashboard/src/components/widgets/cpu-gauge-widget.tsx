"use client";

import { Cpu } from "lucide-react";
import { Gauge } from "@/components/gauge";
import { useSystemData } from "@/hooks/use-dashboard-data";
import type { MachineSensor } from "@/hooks/use-dashboard-data";

function isCpuSensor(sensor: MachineSensor) {
	return /cpu|package|core|x86|k10temp|tctl|tdie/i.test(`${sensor.label} ${sensor.source}`);
}

function averageCpuTemp(sensors: MachineSensor[]) {
	const cpuSensors = sensors.filter(isCpuSensor);
	if (!cpuSensors.length) return null;
	return cpuSensors.reduce((sum, sensor) => sum + sensor.value, 0) / cpuSensors.length;
}

function tempColor(value: number) {
	if (value >= 85) return "#fb7185";
	if (value >= 70) return "#fbbf24";
	return "#34d399";
}

export function CpuGaugeWidget() {
	const { data: sys } = useSystemData();
	const cpuTemp = sys ? averageCpuTemp(sys.sensors?.temperatures ?? []) : null;
	return (
		<div className="h-full flex flex-col items-center justify-center min-h-[200px]">
			{sys ? (
				<Gauge
					value={sys.cpu}
					color="#10b981"
					label="CPU"
					sublabel={`Load: ${sys.load.map((l) => l.toFixed(2)).join(" / ")}`}
					icon={<Cpu className="w-5 h-5" />}
					valueLabel={
						<span className="flex flex-col items-center leading-none">
							<span>{Math.round(sys.cpu)}%</span>
							{cpuTemp !== null && (
								<span className="mt-1 text-sm font-semibold" style={{ color: tempColor(cpuTemp) }}>
									{Math.round(cpuTemp)}<span className="text-[10px]"> °C</span>
								</span>
							)}
						</span>
					}
				/>
			) : (
				<div className="animate-pulse bg-white/[0.04] rounded-full w-32 h-32" />
			)}
		</div>
	);
}
