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
			className="-m-4 flex h-[calc(100%+2rem)] min-h-[112px] flex-col justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 px-6 py-4"
		>
			<div className="flex items-center gap-2 text-xs text-white/40 light:text-slate-700 mb-2">
				<ArrowUp className="w-3.5 h-3.5 text-violet-400" />
				Total Uploaded
			</div>
			<div className="text-2xl font-bold text-violet-400 font-mono">
				{formatBytes(totalTxBytes)}
			</div>
		</motion.div>
	);
}
