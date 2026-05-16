"use client";

import { Cpu } from "lucide-react";
import { useProcessesData } from "@/hooks/use-dashboard-data";
import type { ProcessInfo } from "@/hooks/use-dashboard-data";

export function TopProcessesWidget() {
	const { data } = useProcessesData();
	const processes: ProcessInfo[] = data?.processes ?? [];
	return (
		<div className="h-full flex flex-col min-h-[200px]">
			<h2 className="text-sm font-semibold text-white/80 light:text-slate-700 flex items-center gap-2 mb-4">
				<Cpu className="w-4 h-4 text-cyan-400" />
				Top Processes
			</h2>
			<div className="space-y-0.5 overflow-auto flex-1">
				{processes.slice(0, 10).map((proc) => (
					<div
						key={proc.pid}
						className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-white/[0.02]"
					>
						<span className="w-12 text-[10px] font-mono text-white/30 light:text-slate-700">{proc.pid}</span>
						<span className="w-14 text-[10px] text-white/40 light:text-slate-700 truncate">{proc.user}</span>
						<span className="flex-1 text-[10px] text-white/60 light:text-slate-700 truncate" title={proc.command}>
							{proc.command}
						</span>
						<span
							className={`text-[10px] font-mono font-semibold ${
								proc.cpu > 30
									? "text-red-400"
									: proc.cpu > 10
										? "text-amber-400"
										: "text-emerald-400"
							}`}
						>
							{proc.cpu}%
						</span>
					</div>
				))}
				{!data && (
					<div className="text-center text-white/20 light:text-slate-700 py-8 text-sm">Loading...</div>
				)}
			</div>
		</div>
	);
}
