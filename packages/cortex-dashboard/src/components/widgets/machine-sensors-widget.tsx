"use client";

import { Activity, Fan, Gauge, Thermometer, Zap } from "lucide-react";
import { useSystemData } from "@/hooks/use-dashboard-data";
import type { MachineSensor } from "@/hooks/use-dashboard-data";

function formatSensor(sensor: MachineSensor) {
	if (sensor.unit === "celsius") return `${sensor.value.toFixed(1)} C`;
	if (sensor.unit === "rpm") return `${Math.round(sensor.value)} rpm`;
	return `${sensor.value.toFixed(2)} V`;
}

function sensorTone(sensor: MachineSensor) {
	if (sensor.unit === "celsius") {
		if (sensor.value >= 85) return { text: "text-rose-300", icon: "text-rose-300", bg: "bg-rose-500/12", ring: "ring-rose-400/20", bar: "bg-rose-400", shadow: "shadow-rose-950/20" };
		if (sensor.value >= 70) return { text: "text-amber-300", icon: "text-amber-300", bg: "bg-amber-500/12", ring: "ring-amber-400/20", bar: "bg-amber-400", shadow: "shadow-amber-950/20" };
		return { text: "text-emerald-300", icon: "text-emerald-300", bg: "bg-emerald-500/12", ring: "ring-emerald-400/20", bar: "bg-emerald-400", shadow: "shadow-emerald-950/20" };
	}
	if (sensor.unit === "rpm") return { text: "text-sky-300", icon: "text-sky-300", bg: "bg-sky-500/12", ring: "ring-sky-400/20", bar: "bg-sky-400", shadow: "shadow-sky-950/20" };
	return { text: "text-violet-300", icon: "text-violet-300", bg: "bg-violet-500/12", ring: "ring-violet-400/20", bar: "bg-violet-400", shadow: "shadow-violet-950/20" };
}

function sensorPercent(sensor: MachineSensor) {
	if (sensor.unit === "celsius") return Math.min(100, Math.max(0, (sensor.value / 100) * 100));
	if (sensor.unit === "rpm") return Math.min(100, Math.max(8, (sensor.value / 5000) * 100));
	return Math.min(100, Math.max(8, (sensor.value / 12) * 100));
}

function SensorRow({ sensor }: { sensor: MachineSensor }) {
	const Icon = sensor.unit === "celsius" ? Thermometer : sensor.unit === "rpm" ? Fan : Zap;
	const tone = sensorTone(sensor);
	return (
		<div className={`min-h-16 rounded-lg border border-white/[0.07] bg-white/[0.035] p-3 shadow-sm ${tone.shadow} ring-1 ${tone.ring} light:border-slate-200 light:bg-white`}>
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.bg}`}>
						<Icon className={`h-4 w-4 ${tone.icon}`} />
					</div>
					<div className="min-w-0">
						<p className="truncate text-sm font-semibold text-white/85 light:text-slate-900">{sensor.label}</p>
						<p className="truncate text-xs text-white/40 light:text-slate-500">{sensor.source}</p>
					</div>
				</div>
				<span className={`shrink-0 text-sm font-bold tabular-nums ${tone.text} light:text-slate-800`}>
					{formatSensor(sensor)}
				</span>
			</div>
			<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07] light:bg-slate-100">
				<div
					className={`h-full rounded-full ${tone.bar}`}
					style={{ width: `${sensorPercent(sensor)}%` }}
				/>
			</div>
		</div>
	);
}

function SensorSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
	if (count === 0) return null;
	return (
		<section>
			<div className="mb-2 flex items-center justify-between">
				<p className="text-xs font-semibold uppercase tracking-wide text-white/45 light:text-slate-500">{title}</p>
				<span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-semibold text-white/45 light:bg-slate-100 light:text-slate-500">
					{count}
				</span>
			</div>
			<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
		</section>
	);
}

export function MachineSensorsWidget() {
	const { data: sys } = useSystemData();
	const temperatures = sys?.sensors?.temperatures ?? [];
	const fans = sys?.sensors?.fans ?? [];
	const voltages = sys?.sensors?.voltages ?? [];
	const sensorCount = temperatures.length + fans.length + voltages.length;
	const hottest = temperatures[0];
	const fastestFan = fans[0];

	return (
		<div className="h-full min-h-[340px] p-1">
			<div className="mb-4 flex items-center justify-between">
				<div>
					<p className="text-sm font-semibold text-white/80 light:text-slate-800">Machine Sensors</p>
					<p className="mt-1 text-xs text-white/40 light:text-slate-500">
						{sys ? `${sensorCount} live readings across thermals, fans, and rails` : "Thermals, fans, and voltage rails"}
					</p>
				</div>
				<div className="flex items-center gap-2">
					{hottest ? (
						<span className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${sensorTone(hottest).bg} ${sensorTone(hottest).text}`}>
							{hottest.value.toFixed(1)} C
						</span>
					) : null}
					{fastestFan ? (
						<span className="rounded-full bg-sky-500/12 px-2.5 py-1 text-xs font-bold tabular-nums text-sky-300">
							{Math.round(fastestFan.value)} rpm
						</span>
					) : null}
					<Gauge className="h-5 w-5 text-white/40 light:text-slate-500" />
				</div>
			</div>
			{sys ? (
				sensorCount ? (
					<div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
						<SensorSection title="Temperatures" count={temperatures.length}>
							{temperatures.map((sensor) => (
								<SensorRow key={sensor.id} sensor={sensor} />
							))}
						</SensorSection>
						<SensorSection title="Fans" count={fans.length}>
							{fans.map((sensor) => (
								<SensorRow key={sensor.id} sensor={sensor} />
							))}
						</SensorSection>
						<SensorSection title="Voltages" count={voltages.length}>
							{voltages.map((sensor) => (
								<SensorRow key={sensor.id} sensor={sensor} />
							))}
						</SensorSection>
					</div>
				) : (
					<div className="flex h-36 flex-col items-center justify-center text-center text-sm text-white/40 light:text-slate-500">
						<Activity className="mb-2 h-5 w-5" />
						No machine sensors exposed by the host
					</div>
				)
			) : (
				<div className="space-y-2">
					{Array.from({ length: 6 }).map((_, index) => (
						<div key={index} className="h-16 animate-pulse rounded-lg bg-white/[0.04] light:bg-slate-100" />
					))}
				</div>
			)}
		</div>
	);
}
