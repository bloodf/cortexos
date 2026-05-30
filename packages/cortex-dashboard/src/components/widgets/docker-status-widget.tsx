"use client";

import { Container } from "lucide-react";
import { useDockerData } from "@/hooks/use-dashboard-data";

export function DockerStatusWidget() {
	const { data } = useDockerData();
	const containers = Array.isArray(data?.containers?.data) ? data.containers.data as Record<string, unknown>[] : [];
	const count = containers.filter((c) => c.State === "running").length;
	return (
		<div className="h-full flex flex-col gap-3">
			<h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
				<Container className="h-4 w-4 text-chart-3" />
				Docker
			</h2>
			<div className="text-3xl font-bold">{count}</div>
			<p className="text-xs text-muted-foreground">running containers</p>
		</div>
	);
}
