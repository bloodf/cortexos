"use client";

import { useRef, useState, useEffect } from "react";
import { Wifi } from "lucide-react";
import { NetChart } from "@/components/net-chart";
import { useNetworkData } from "@/hooks/use-dashboard-data";
import type { NetworkInterface } from "@/hooks/use-dashboard-data";

interface ChartPoint {
	time: string;
	rx: number;
	tx: number;
}

export function NetworkGraphWidget() {
	const { data: net } = useNetworkData();
	const historyRef = useRef<ChartPoint[]>([]);
	const [history, setHistory] = useState<ChartPoint[]>([]);

	useEffect(() => {
		if (net?.interfaces) {
			const now = new Date();
			const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
			const totalRx = net.interfaces.reduce((s: number, i: NetworkInterface) => s + i.rxKbps, 0);
			const totalTx = net.interfaces.reduce((s: number, i: NetworkInterface) => s + i.txKbps, 0);
			historyRef.current = [
				...historyRef.current.slice(-59),
				{ time, rx: totalRx, tx: totalTx },
			];
			setHistory(historyRef.current);
		}
	}, [net]);

	return (
		<div className="h-full flex flex-col min-h-[200px]">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-sm font-semibold text-white/80 light:text-slate-700 flex items-center gap-2">
					<Wifi className="w-4 h-4 text-violet-400" />
					Network
				</h2>
				<div className="flex gap-3 text-xs">
					<span className="flex items-center gap-1.5">
						<span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
						Inbound
					</span>
					<span className="flex items-center gap-1.5">
						<span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
						Outbound
					</span>
				</div>
			</div>
			<div className="flex-1 min-h-0">
				<NetChart
					data={history.length ? history : Array(20).fill({ time: "", rx: 0, tx: 0 })}
				/>
			</div>
		</div>
	);
}
