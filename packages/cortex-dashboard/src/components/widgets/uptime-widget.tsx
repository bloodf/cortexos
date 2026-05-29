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
			<h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
				<Activity className="h-4 w-4 text-success" />
				Host Uptime
			</h2>
			<div className="text-3xl font-bold">{display}</div>
			<p className="text-xs text-muted-foreground">system uptime</p>
		</div>
	);
}
