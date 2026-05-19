"use client";

import { Activity } from "lucide-react";
import { useSystemData } from "@/hooks/use-dashboard-data";

function formatUptime(raw: unknown): string {
	if (typeof raw === "string" && raw.trim()) return raw;
	if (typeof raw === "number") return `${Math.floor(raw / 3600)}h`;
	return "—";
}

export function UptimeWidget() {
	const { data: sys } = useSystemData();
	const display = formatUptime(sys?.uptime);

	return (
		<div className="h-full flex flex-col gap-3">
			<h2 className="text-sm font-semibold text-white/80 light:text-slate-700 flex items-center gap-2">
				<Activity className="w-4 h-4 text-emerald-400" />
				Host Uptime
			</h2>
			<div className="text-3xl font-bold">{display}</div>
			<p className="text-xs text-muted-foreground">system uptime</p>
		</div>
	);
}
