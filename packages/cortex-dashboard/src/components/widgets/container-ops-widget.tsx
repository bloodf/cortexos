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
			className="flex h-full min-h-[80px] flex-col justify-center rounded-xl border border-chart-3/20 bg-chart-3/5 p-4"
		>
			<div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
				<Box className="h-4 w-4 text-chart-3" />
				Container Ops
			</div>
			<div className="flex items-baseline gap-2 font-mono text-3xl font-bold text-chart-3">
				{online} <span className="text-sm font-normal text-muted-foreground">online</span>
				{offlineCount > 0 && <span className="ml-2 text-sm font-normal text-destructive">{offlineCount} offline</span>}
			</div>
		</motion.div>
	);
}
