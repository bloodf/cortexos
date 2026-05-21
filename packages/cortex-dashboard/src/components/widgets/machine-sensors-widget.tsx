"use client";

import { Activity, Cpu, Fan, GaugeIcon, Thermometer, Zap } from "lucide-react";
import { Gauge } from "@/components/gauge";
import { useSystemData } from "@/hooks/use-dashboard-data";
import type { MachineSensor } from "@/hooks/use-dashboard-data";

type Tone = { color: string; text: string; icon: string; bg: string; ring: string; bar: string; shadow: string };

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
	if (sensor.unit === "rpm") return { color: "#38bdf8", text: "text-sky-300", icon: "text-sky-300", bg: "bg-sky-500/12", ring: "ring-sky-400/20", bar: "bg-sky-400", shadow: "shadow-sky-950/20" };
	return { color: "#a78bfa", text: "text-violet-300", icon: "text-violet-300", bg: "bg-violet-500/12", ring: "ring-violet-400/20", bar: "bg-violet-400", shadow: "shadow-violet-950/20" };
}

function temperatureTone(value: number): Tone {
	if (value >= 85) return { color: "#fb7185", text: "text-rose-300", icon: "text-rose-300", bg: "bg-rose-500/12", ring: "ring-rose-400/20", bar: "bg-rose-400", shadow: "shadow-rose-950/20" };
	if (value >= 70) return { color: "#fbbf24", text: "text-amber-300", icon: "text-amber-300", bg: "bg-amber-500/12", ring: "ring-amber-400/20", bar: "bg-amber-400", shadow: "shadow-amber-950/20" };
	return { color: "#34d399", text: "text-emerald-300", icon: "text-emerald-300", bg: "bg-emerald-500/12", ring: "ring-emerald-400/20", bar: "bg-emerald-400", shadow: "shadow-emerald-950/20" };
}

function average(sensors: MachineSensor[]) {
	if (!sensors.length) return 0;
	return sensors.reduce((sum, sensor) => sum + sensor.value, 0) / sensors.length;
}

function isCpuSensor(sensor: MachineSensor) {
	return /cpu|package|core|x86|k10temp|tctl|tdie/i.test(`${sensor.label} ${sensor.source}`);
}

function SensorRow({ sensor }: { sensor: MachineSensor }) {
	const tone = sensorTone(sensor);
	return (
		<div className={`flex min-h-8 items-center justify-between gap-3 rounded-md border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 shadow-sm ${tone.shadow} ring-1 ${tone.ring} light:border-slate-200 light:bg-white`}>
			<p className="min-w-0 truncate text-[11px] font-semibold leading-4 text-white/85 light:text-slate-900">{sensor.label}</p>
			<span className={`shrink-0 text-[11px] font-bold leading-4 tabular-nums ${tone.text} light:text-slate-800`}>
				{formatSensor(sensor)}
			</span>
		</div>
	);
}

function SensorGroup({ title, subtitle, sensors, averageValue, gaugeValue, unit, color, icon }: { title: string; subtitle: string; sensors: MachineSensor[]; averageValue: number; gaugeValue: number; unit: string; color: string; icon: React.ReactNode }) {
	if (!sensors.length) return null;
	return (
		<section className="grid gap-2 lg:grid-cols-[180px_minmax(0,1fr)]">
			<div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 light:border-slate-200 light:bg-white/70">
				<div className="flex items-center justify-between gap-2">
					<p className="text-sm font-semibold text-white/85 light:text-slate-900">{title}</p>
					<span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-white/45 light:bg-slate-100 light:text-slate-500">{sensors.length}</span>
				</div>
				<div className="mt-2 flex items-center justify-center rounded-lg bg-black/10 py-2 light:bg-slate-50">
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
				</div>
			</div>
			<div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 light:border-slate-200 light:bg-white/70">
				<div className="mb-2 flex items-center justify-between gap-2">
					<p className="truncate text-xs font-semibold text-white/55 light:text-slate-600">{subtitle}</p>
				</div>
				<div className="grid max-h-40 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
					{sensors.map((sensor) => <SensorRow key={sensor.id} sensor={sensor} />)}
				</div>
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
					<div className="grid max-h-[760px] gap-4 overflow-y-auto pr-1">
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
