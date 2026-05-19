"use client";

import { XCircle } from "lucide-react";
import { useServicesData } from "@/hooks/use-dashboard-data";
import type { ServiceCheck } from "@/hooks/use-dashboard-data";

export function ServiceOfflineWidget() {
	const { data } = useServicesData();
	const services: ServiceCheck[] = data?.services ?? [];
	const offline = services.filter((s) => s.status === "offline").length;
	return (
		<div className="h-full flex items-center gap-3 border border-red-500/20 rounded-xl px-4 py-3 bg-white/[0.01] min-h-[80px]">
			<div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
				<XCircle className="w-5 h-5 text-red-400" />
			</div>
			<div>
				<div className="text-2xl font-bold text-red-400">{offline}</div>
				<div className="text-xs text-white/40 light:text-slate-700">Offline</div>
			</div>
		</div>
	);
}
