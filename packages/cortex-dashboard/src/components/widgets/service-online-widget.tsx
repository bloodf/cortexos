"use client";

import { CheckCircle2 } from "lucide-react";
import { useServicesData } from "@/hooks/use-dashboard-data";
import type { ServiceCheck } from "@/hooks/use-dashboard-data";

export function ServiceOnlineWidget() {
	const { data } = useServicesData();
	const services: ServiceCheck[] = data?.services ?? [];
	const online = services.filter((s) => s.status === "online").length;
	return (
		<div className="-m-4 flex h-[calc(100%+2rem)] min-h-[112px] items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-4">
			<CheckCircle2 className="h-7 w-7 text-emerald-400" />
			<div>
				<div className="text-2xl font-bold text-emerald-400">{online}</div>
				<div className="text-xs text-white/40 light:text-slate-700">Online</div>
			</div>
		</div>
	);
}
