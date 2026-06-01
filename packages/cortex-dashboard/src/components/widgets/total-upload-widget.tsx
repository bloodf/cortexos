"use client";

import { ArrowUp } from "lucide-react";
import { motion } from "framer-motion";
import { useNetworkData } from "@/hooks/use-dashboard-data";
import type { NetworkInterface } from "@/hooks/use-dashboard-data";
import { formatBytes } from "@/lib/utils";

export function TotalUploadWidget() {
	const { data: net } = useNetworkData();
	const totalTxBytes = net?.interfaces
		? net.interfaces.reduce((s: number, i: NetworkInterface) => s + i.txBytesTotal, 0)
		: 0;

	return (
		<motion.div
			whileHover={{ scale: 1.02 }}
			className="flex h-full min-h-[80px] flex-col justify-center rounded-xl border border-border bg-muted/30 p-4"
		>
			<div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
				<ArrowUp className="size-3.5 text-chart-4" />
				Total Uploaded
			</div>
			<div className="font-mono text-2xl font-bold text-chart-4">
				{formatBytes(totalTxBytes)}
			</div>
		</motion.div>
	);
}
