"use client";

import { Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useServicesData } from "@/hooks/use-dashboard-data";
import type { ServiceCheck } from "@/hooks/use-dashboard-data";

export function MonitoringOpsWidget() {
	const { data } = useServicesData();
	const services: ServiceCheck[] = data?.services ?? [];
	const monServices = services.filter((s) => s.category === "Monitoring");
	const online = monServices.filter((s) => s.status === "online").length;
	const offline = monServices.filter((s) => s.status === "offline").length;

	return (
		<motion.div
			whileHover={{ scale: 1.02 }}
			className="-m-4 flex h-[calc(100%+2rem)] min-h-[112px] flex-col justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 px-6 py-4"
		>
			<div className="flex items-center gap-2 text-xs text-white/50 light:text-slate-700 mb-2 font-medium tracking-wide uppercase">
				<Activity className="w-4 h-4 text-amber-400" />
				Monitoring
			</div>
			<div className="text-3xl font-bold text-amber-400 font-mono flex items-baseline gap-2">
				{online} <span className="text-sm font-normal text-white/40 light:text-slate-700">online</span>
				{offline > 0 && <span className="text-sm font-normal text-red-400 ml-2">{offline} offline</span>}
			</div>
		</motion.div>
	);
}
