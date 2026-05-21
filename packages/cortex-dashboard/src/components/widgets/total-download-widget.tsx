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
		<div className="-m-4 flex h-[calc(100%+2rem)] min-h-[112px] flex-col justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-6 py-4">
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
