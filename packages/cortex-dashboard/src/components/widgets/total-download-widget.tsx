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
		<div className="flex h-full min-h-[80px] flex-col justify-center rounded-xl border border-border bg-muted/30 p-4">
			<div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
				<ArrowDown className="h-3.5 w-3.5 text-chart-3" />
				Total Downloaded
			</div>
			<div className="font-mono text-2xl font-bold text-chart-3">
				{formatBytes(totalRxBytes)}
			</div>
		</div>
	);
}
