"use client";

import { Badge } from "@/components/ui/badge";

interface CheckTypeBadgeProps {
	type: "http" | "tcp" | "docker" | "process" | "systemd";
}

const TYPE_STYLES: Record<string, string> = {
	http: "bg-chart-1/10 text-chart-1 border-chart-1/20",
	tcp: "bg-chart-2/10 text-chart-2 border-chart-2/20",
	docker: "bg-chart-3/10 text-chart-3 border-chart-3/20",
	process: "bg-chart-4/10 text-chart-4 border-chart-4/20",
	systemd: "bg-chart-5/10 text-chart-5 border-chart-5/20",
};

const TYPE_LABELS: Record<string, string> = {
	http: "HTTP",
	tcp: "TCP",
	docker: "Docker",
	process: "Process",
	systemd: "Systemd",
};

export function CheckTypeBadge({ type }: CheckTypeBadgeProps) {
	return (
		<Badge
			variant="outline"
			className={`text-[10px] font-medium uppercase tracking-wider ${TYPE_STYLES[type] || TYPE_STYLES.http}`}
		>
			{TYPE_LABELS[type] || type}
		</Badge>
	);
}
