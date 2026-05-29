"use client";

import { Database } from "lucide-react";
import { motion } from "framer-motion";
import { useServicesData } from "@/hooks/use-dashboard-data";
import type { ServiceCheck } from "@/hooks/use-dashboard-data";

export function DatabaseOpsWidget() {
	const { data } = useServicesData();
	const services: ServiceCheck[] = data?.services ?? [];
	const dbServices = services.filter((s) => s.category === "Database");
	const online = dbServices.filter((s) => s.status === "online").length;
	const offline = dbServices.filter((s) => s.status === "offline").length;

	return (
		<motion.div
			whileHover={{ scale: 1.02 }}
			className="flex h-full min-h-[80px] flex-col justify-center rounded-xl border border-success/20 bg-success/5 p-4"
		>
			<div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
				<Database className="h-4 w-4 text-success" />
				Database
			</div>
			<div className="flex items-baseline gap-2 font-mono text-3xl font-bold text-success">
				{online} <span className="text-sm font-normal text-muted-foreground">online</span>
				{offline > 0 && <span className="ml-2 text-sm font-normal text-destructive">{offline} offline</span>}
			</div>
		</motion.div>
	);
}
