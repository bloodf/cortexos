"use client";

import { XCircle } from "lucide-react";
import { useServicesData } from "@/hooks/use-dashboard-data";
import type { ServiceCheck } from "@/hooks/use-dashboard-data";

export function ServiceOfflineWidget() {
	const { data } = useServicesData();
	const services: ServiceCheck[] = data?.services ?? [];
	const offline = services.filter((s) => s.status === "offline").length;
	return (
		<div className="-m-4 flex h-[calc(100%+2rem)] min-h-[112px] items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4">
			<XCircle className="h-7 w-7 text-red-400" />
			<div>
				<div className="text-2xl font-bold text-red-400">{offline}</div>
				<div className="text-xs text-white/40 light:text-slate-700">Offline</div>
			</div>
		</div>
	);
}
