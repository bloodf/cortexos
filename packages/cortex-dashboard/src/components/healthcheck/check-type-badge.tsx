"use client";

import { Badge } from "@/components/ui/badge";

interface CheckTypeBadgeProps {
	type: "http" | "tcp" | "docker" | "process";
}

const TYPE_STYLES: Record<string, string> = {
	http: "bg-blue-500/10 text-blue-400 border-blue-500/20",
	tcp: "bg-purple-500/10 text-purple-400 border-purple-500/20",
	docker: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
	process: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const TYPE_LABELS: Record<string, string> = {
	http: "HTTP",
	tcp: "TCP",
	docker: "Docker",
	process: "Process",
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
