"use client";

import { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { NetChart } from "@/components/net-chart";

interface NetInterface {
	name: string;
	rxKbps: number;
	txKbps: number;
	rxBytesTotal: number;
	txBytesTotal: number;
}

interface NetPoint {
	time: string;
	rx: number;
	tx: number;
}

const HISTORY_LIMIT = 60;

function formatRate(kbps: number): string {
	if (kbps > 1024) return `${(kbps / 1024).toFixed(2)} MB/s`;
	return `${kbps.toFixed(1)} KB/s`;
}

function formatBytes(bytes: number): string {
	if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
	if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
	if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
	return `${bytes} B`;
}

export default function NetworkPage() {
	const [interfaces, setInterfaces] = useState<NetInterface[]>([]);
	const [history, setHistory] = useState<NetPoint[]>([]);
	const [loading, setLoading] = useState(true);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		const fetchData = async () => {
			try {
				const res = await fetch("/api/network", { cache: "no-store" });
				if (!res.ok || !mountedRef.current) return;
				const data = await res.json();
				const list: NetInterface[] = Array.isArray(data.interfaces)
					? data.interfaces
					: [];
				setInterfaces(list);
				setLoading(false);
				const rxTotal = list.reduce((s, i) => s + i.rxKbps, 0);
				const txTotal = list.reduce((s, i) => s + i.txKbps, 0);
				const now = new Date();
				const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
				setHistory((prev) => {
					const next = [...prev, { time, rx: rxTotal, tx: txTotal }];
					return next.length > HISTORY_LIMIT
						? next.slice(next.length - HISTORY_LIMIT)
						: next;
				});
			} catch {
				// polling retries
			}
		};
		fetchData();
		const interval = setInterval(fetchData, 3000);
		return () => {
			mountedRef.current = false;
			clearInterval(interval);
		};
	}, []);

	const rxTotalKbps = interfaces.reduce((s, i) => s + i.rxKbps, 0);
	const txTotalKbps = interfaces.reduce((s, i) => s + i.txKbps, 0);
	const rxBytesTotal = interfaces.reduce((s, i) => s + i.rxBytesTotal, 0);
	const txBytesTotal = interfaces.reduce((s, i) => s + i.txBytesTotal, 0);

	return (
		<div className="space-y-4 animate-[slide-in_0.4s_ease-out]">
			<div className="flex items-center gap-2 text-sm text-white/40 light:text-slate-700">
				<Activity className="w-4 h-4" />
				<span>{interfaces.length} interfaces</span>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<StatCard label="Inbound" value={formatRate(rxTotalKbps)} accent="text-cyan-400" />
				<StatCard label="Outbound" value={formatRate(txTotalKbps)} accent="text-violet-400" />
				<StatCard label="Total RX" value={formatBytes(rxBytesTotal)} accent="text-cyan-400" />
				<StatCard label="Total TX" value={formatBytes(txBytesTotal)} accent="text-violet-400" />
			</div>

			<div className="glass-panel rounded-2xl p-4">
				<div className="mb-3 text-xs uppercase tracking-wider text-white/40 light:text-slate-700">
					Throughput history
				</div>
				<NetChart data={history} />
			</div>

			<div className="glass-panel rounded-2xl p-4 overflow-x-auto">
				<table className="w-full text-left text-xs">
					<thead>
						<tr className="border-b border-white/[0.06]">
							<th className="pb-3 pr-4 text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
								Interface
							</th>
							<th className="pb-3 pr-4 text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider text-right">
								RX
							</th>
							<th className="pb-3 pr-4 text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider text-right">
								TX
							</th>
							<th className="pb-3 pr-4 text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider text-right">
								Total RX
							</th>
							<th className="pb-3 text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider text-right">
								Total TX
							</th>
						</tr>
					</thead>
					<tbody>
						{loading && (
							<tr>
								<td colSpan={5} className="py-6 text-center text-white/20 light:text-slate-700">
									Loading…
								</td>
							</tr>
						)}
						{!loading && interfaces.length === 0 && (
							<tr>
								<td colSpan={5} className="py-6 text-center text-white/20 light:text-slate-700">
									No interfaces detected
								</td>
							</tr>
						)}
						{interfaces.map((i) => (
							<tr key={i.name} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
								<td className="py-2 pr-4 font-mono text-white/70 light:text-slate-700">{i.name}</td>
								<td className="py-2 pr-4 text-right font-mono text-cyan-400">{formatRate(i.rxKbps)}</td>
								<td className="py-2 pr-4 text-right font-mono text-violet-400">{formatRate(i.txKbps)}</td>
								<td className="py-2 pr-4 text-right font-mono text-white/40 light:text-slate-700">
									{formatBytes(i.rxBytesTotal)}
								</td>
								<td className="py-2 text-right font-mono text-white/40 light:text-slate-700">
									{formatBytes(i.txBytesTotal)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

interface StatCardProps {
	label: string;
	value: string;
	accent: string;
}

function StatCard({ label, value, accent }: StatCardProps) {
	return (
		<div className="glass-panel rounded-2xl p-4">
			<div className="text-[11px] uppercase tracking-wider text-white/40 light:text-slate-700">
				{label}
			</div>
			<div className={`mt-1 font-mono text-xl font-semibold ${accent}`}>{value}</div>
		</div>
	);
}
