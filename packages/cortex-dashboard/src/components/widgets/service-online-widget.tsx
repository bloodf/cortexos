"use client";

import { CheckCircle2 } from "lucide-react";
import { useServicesData } from "@/hooks/use-dashboard-data";
import type { ServiceCheck } from "@/hooks/use-dashboard-data";

export function ServiceOnlineWidget() {
	const { data } = useServicesData();
	const services: ServiceCheck[] = data?.services ?? [];
	const online = services.filter((s) => s.status === "online").length;
	return (
		<div className="h-full flex items-center gap-3 border border-emerald-500/20 rounded-xl px-4 py-3 bg-white/[0.01] min-h-[80px]">
			<div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
				<CheckCircle2 className="w-5 h-5 text-emerald-400" />
			</div>
			<div>
				<div className="text-2xl font-bold text-emerald-400">{online}</div>
				<div className="text-xs text-white/40 light:text-slate-700">Online</div>
			</div>
		</div>
	);
}
