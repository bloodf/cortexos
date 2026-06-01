"use client";

import { CheckCircle2 } from "lucide-react";
import { useServicesData } from "@/hooks/use-dashboard-data";
import type { ServiceCheck } from "@/hooks/use-dashboard-data";

export function ServiceOnlineWidget() {
	const { data } = useServicesData();
	const services: ServiceCheck[] = data?.services ?? [];
	const online = services.filter((s) => s.status === "online").length;
	return (
		<div className="flex h-full min-h-[80px] items-center gap-3 rounded-xl border border-success/20 bg-success/5 px-4 py-3">
			<div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
				<CheckCircle2 className="size-5 text-success" />
			</div>
			<div>
				<div className="text-2xl font-bold text-success">{online}</div>
				<div className="text-xs text-muted-foreground">Online</div>
			</div>
		</div>
	);
}
