"use client";

import { ArrowDown } from "lucide-react";
import { useNetworkData } from "@/hooks/use-dashboard-data";
import type { NetworkInterface } from "@/hooks/use-dashboard-data";
import { formatBytes } from "@/lib/utils";

export function TotalDownloadWidget() {
	const { data: net } = useNetworkData();
	const totalRxBytes = net?.interfaces
		? net.interfaces.reduce((s: number, i: NetworkInterface) => s + i.rxBytesTotal, 0)
		: 0;

	return (
		<div className="h-full flex flex-col justify-center bg-white/[0.02] rounded-xl p-4 border border-white/[0.04] min-h-[80px]">
			<div className="flex items-center gap-2 text-xs text-white/40 light:text-slate-700 mb-2">
				<ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
				Total Downloaded
			</div>
			<div className="text-2xl font-bold text-cyan-400 font-mono">
				{formatBytes(totalRxBytes)}
			</div>
		</div>
	);
}
