"use client";

import { Activity, Cpu, Fan, GaugeIcon, Thermometer, Zap } from "lucide-react";
import { Gauge } from "@/components/gauge";
import { useSystemData } from "@/hooks/use-dashboard-data";
import type { MachineSensor } from "@/hooks/use-dashboard-data";

type Tone = { color: string; text: string; badge: string; panel: string };

function formatSensor(sensor: MachineSensor) {
	if (sensor.unit === "celsius") return `${Math.round(sensor.value)} C`;
	if (sensor.unit === "rpm") return `${Math.round(sensor.value)} rpm`;
	return `${sensor.value.toFixed(2)} V`;
}

function formatGaugeValue(value: number, unit: string) {
	if (unit === "C") return `${Math.round(value)}C`;
	if (unit === "rpm") return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`;
	if (unit === "V") return `${value.toFixed(1)}V`;
	return `${Math.round(value)}`;
}

function sensorTone(sensor: MachineSensor): Tone {
	if (sensor.unit === "celsius") return temperatureTone(sensor.value);
	if (sensor.unit === "rpm") return { color: "#38bdf8", text: "text-sky-300", badge: "bg-sky-500/10 text-sky-300", panel: "border-sky-400/15" };
	return { color: "#a78bfa", text: "text-violet-300", badge: "bg-violet-500/10 text-violet-300", panel: "border-violet-400/15" };
}

function temperatureTone(value: number): Tone {
	if (value >= 85) return { color: "#fb7185", text: "text-rose-300", badge: "bg-rose-500/10 text-rose-300", panel: "border-rose-400/15" };
	if (value >= 70) return { color: "#fbbf24", text: "text-amber-300", badge: "bg-amber-500/10 text-amber-300", panel: "border-amber-400/15" };
	return { color: "#34d399", text: "text-emerald-300", badge: "bg-emerald-500/10 text-emerald-300", panel: "border-emerald-400/15" };
}

function average(sensors: MachineSensor[]) {
	if (!sensors.length) return 0;
	return sensors.reduce((sum, sensor) => sum + sensor.value, 0) / sensors.length;
}

function isCpuSensor(sensor: MachineSensor) {
	return /cpu|package|core|x86|k10temp|tctl|tdie/i.test(`${sensor.label} ${sensor.source}`);
}

function statusLabel(value: number, unit: string) {
	if (unit === "C") {
		if (value >= 85) return "Hot";
		if (value >= 70) return "Warm";
		return "Normal";
	}
	if (unit === "rpm") return value > 0 ? "Spinning" : "Idle";
	if (unit === "V") return "Nominal";
	return "Live";
}

function SensorRow({ sensor }: { sensor: MachineSensor }) {
	const tone = sensorTone(sensor);
	return (
		<div className="flex min-h-7 items-center justify-between gap-3 border-b border-white/[0.05] px-1 py-1 last:border-b-0 light:border-slate-100">
			<p className="min-w-0 truncate text-[11px] font-medium leading-4 text-white/70 light:text-slate-700">{sensor.label}</p>
			<span className={`shrink-0 text-[11px] font-semibold leading-4 tabular-nums ${tone.text} light:text-slate-800`}>
				{formatSensor(sensor)}
			</span>
		</div>
	);
}

function SensorGroup({ title, subtitle, sensors, averageValue, gaugeValue, unit, color, icon }: { title: string; subtitle: string; sensors: MachineSensor[]; averageValue: number; gaugeValue: number; unit: string; color: string; icon: React.ReactNode }) {
	if (!sensors.length) return null;
	const tone = unit === "C" ? temperatureTone(averageValue) : unit === "rpm" ? sensorTone({ ...sensors[0], unit: "rpm" }) : sensorTone({ ...sensors[0], unit: "volts" });
	return (
		<section className={`min-h-0 overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025] light:border-slate-200 light:bg-white/75 ${tone.panel}`}>
			<div className="border-b border-white/[0.06] p-3 light:border-slate-100">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
							<p className="truncate text-sm font-semibold text-white/85 light:text-slate-900">{title}</p>
						</div>
						<p className="mt-1 truncate text-xs text-white/40 light:text-slate-500">{subtitle}</p>
					</div>
					<span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.badge}`}>
						{statusLabel(averageValue, unit)}
					</span>
				</div>
				<div className="mt-3 grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3">
					<Gauge
						value={Math.round(gaugeValue)}
						color={color}
						label={`${formatGaugeValue(averageValue, unit)} avg`}
						sublabel={unit === "rpm" ? "fan speed" : unit === "V" ? "rail reading" : "temperature"}
						icon={icon}
						size={108}
						strokeWidth={8}
						valueLabel={formatGaugeValue(averageValue, unit)}
					/>
					<div className="min-w-0">
						<p className={`text-3xl font-bold tabular-nums ${tone.text}`}>{formatGaugeValue(averageValue, unit)}</p>
						<p className="mt-1 text-xs text-white/40 light:text-slate-500">{sensors.length} readings</p>
					</div>
				</div>
			</div>
			<div className="max-h-48 overflow-y-auto px-3 py-2">
				{sensors.map((sensor) => <SensorRow key={sensor.id} sensor={sensor} />)}
			</div>
		</section>
	);
}

export function MachineSensorsWidget() {
	const { data: sys } = useSystemData();
	const temperatures = sys?.sensors?.temperatures ?? [];
	const cpuTemps = temperatures.filter(isCpuSensor);
	const otherTemps = temperatures.filter((sensor) => !isCpuSensor(sensor));
	const fans = sys?.sensors?.fans ?? [];
	const voltages = sys?.sensors?.voltages ?? [];
	const sensorCount = temperatures.length + fans.length + voltages.length;
	const cpuAvg = average(cpuTemps);
	const tempAvg = average(otherTemps);
	const fanAvg = average(fans);
	const voltageAvg = average(voltages);

	return (
		<div className="h-full min-h-[520px] p-1">
			<div className="mb-4 flex items-center justify-between">
				<div>
					<p className="text-sm font-semibold text-white/80 light:text-slate-800">Machine Sensors</p>
					<p className="mt-1 text-xs text-white/40 light:text-slate-500">
						{sys ? `${sensorCount} live readings grouped by hardware family` : "Thermals, fans, and voltage rails"}
					</p>
				</div>
				<GaugeIcon className="h-5 w-5 text-white/40 light:text-slate-500" />
			</div>
			{sys ? (
				sensorCount ? (
					<div className="grid max-h-[760px] gap-3 overflow-y-auto pr-1 lg:grid-cols-2">
						<SensorGroup title="CPU" subtitle="Average of CPU/package/core temperature sensors" sensors={cpuTemps} averageValue={cpuAvg} gaugeValue={Math.min(100, cpuAvg)} unit="C" color={temperatureTone(cpuAvg).color} icon={<Cpu className="h-5 w-5" />} />
						<SensorGroup title="Thermals" subtitle="Average of non-CPU temperature sensors" sensors={otherTemps} averageValue={tempAvg} gaugeValue={Math.min(100, tempAvg)} unit="C" color={temperatureTone(tempAvg).color} icon={<Thermometer className="h-5 w-5" />} />
						<SensorGroup title="Fans" subtitle="Average fan speed across exposed tachometers" sensors={fans} averageValue={fanAvg} gaugeValue={Math.min(100, (fanAvg / 5000) * 100)} unit="rpm" color="#38bdf8" icon={<Fan className="h-5 w-5" />} />
						<SensorGroup title="Voltage Rails" subtitle="Average exposed voltage rail reading" sensors={voltages} averageValue={voltageAvg} gaugeValue={Math.min(100, (voltageAvg / 12) * 100)} unit="V" color="#a78bfa" icon={<Zap className="h-5 w-5" />} />
					</div>
				) : (
					<div className="flex h-36 flex-col items-center justify-center text-center text-sm text-white/40 light:text-slate-500">
						<Activity className="mb-2 h-5 w-5" />
						No machine sensors exposed by the host
					</div>
				)
			) : (
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-xl bg-white/[0.04] light:bg-slate-100" />)}
				</div>
			)}
		</div>
	);
}
