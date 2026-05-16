"use client";

import { Container } from "lucide-react";
import { useDockerData } from "@/hooks/use-dashboard-data";

export function DockerStatusWidget() {
	const { data } = useDockerData();
	const containers = Array.isArray(data?.containers?.data) ? data.containers.data as Record<string, unknown>[] : [];
	const count = containers.filter((c) => c.State === "running").length;
	return (
		<div className="h-full flex flex-col gap-3">
			<h2 className="text-sm font-semibold text-white/80 light:text-slate-700 flex items-center gap-2">
				<Container className="w-4 h-4 text-sky-400" />
				Docker
			</h2>
			<div className="text-3xl font-bold">{count}</div>
			<p className="text-xs text-muted-foreground">running containers</p>
		</div>
	);
}
