"use client";

import { XCircle } from "lucide-react";
import { useServicesData } from "@/hooks/use-dashboard-data";
import type { ServiceCheck } from "@/hooks/use-dashboard-data";

export function ServiceOfflineWidget() {
	const { data } = useServicesData();
	const services: ServiceCheck[] = data?.services ?? [];
	const offline = services.filter((s) => s.status === "offline").length;
	return (
		<div className="flex h-full min-h-[80px] items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
			<div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
				<XCircle className="size-5 text-destructive" />
			</div>
			<div>
				<div className="text-2xl font-bold text-destructive">{offline}</div>
				<div className="text-xs text-muted-foreground">Offline</div>
			</div>
		</div>
	);
}
