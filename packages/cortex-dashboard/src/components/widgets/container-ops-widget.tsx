"use client";

import { Box } from "lucide-react";
import { motion } from "framer-motion";
import { useServicesData } from "@/hooks/use-dashboard-data";
import type { ServiceCheck } from "@/hooks/use-dashboard-data";

export function ContainerOpsWidget() {
	const { data } = useServicesData();
	const services: ServiceCheck[] = data?.services ?? [];
	const infraServices = services.filter((s) => s.category === "Infrastructure");
	const online = infraServices.filter((s) => s.status === "online").length;
	const offlineCount = infraServices.filter((s) => s.status === "offline").length;

	return (
		<motion.div
			whileHover={{ scale: 1.02 }}
			className="-m-4 flex h-[calc(100%+2rem)] min-h-[112px] flex-col justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 px-6 py-4"
		>
			<div className="flex items-center gap-2 text-xs text-white/50 light:text-slate-700 mb-2 font-medium tracking-wide uppercase">
				<Box className="w-4 h-4 text-blue-400" />
				Container Ops
			</div>
			<div className="text-3xl font-bold text-blue-400 font-mono flex items-baseline gap-2">
				{online} <span className="text-sm font-normal text-white/40 light:text-slate-700">online</span>
				{offlineCount > 0 && <span className="text-sm font-normal text-red-400 ml-2">{offlineCount} offline</span>}
			</div>
		</motion.div>
	);
}
