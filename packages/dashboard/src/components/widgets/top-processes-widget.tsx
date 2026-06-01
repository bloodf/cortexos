"use client";

import { Cpu } from "lucide-react";
import { useProcessesData } from "@/hooks/use-dashboard-data";
import type { ProcessInfo } from "@/hooks/use-dashboard-data";

export function TopProcessesWidget() {
	const { data } = useProcessesData();
	const processes: ProcessInfo[] = data?.processes ?? [];
	return (
		<div className="h-full flex flex-col min-h-[200px]">
			<h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
				<Cpu className="size-4 text-chart-3" />
				Top Processes
			</h2>
			<div className="flex-1 space-y-0.5 overflow-auto">
				{processes.slice(0, 10).map((proc) => (
					<div
						key={proc.pid}
						className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-muted/50"
					>
						<span className="w-12 font-mono text-[10px] text-muted-foreground">{proc.pid}</span>
						<span className="w-14 truncate text-[10px] text-muted-foreground">{proc.user}</span>
						<span className="flex-1 truncate text-[10px] text-foreground" title={proc.command}>
							{proc.command}
						</span>
						<span
							className={`font-mono text-[10px] font-semibold ${
								proc.cpu > 30
									? "text-destructive"
									: proc.cpu > 10
										? "text-warning"
										: "text-success"
							}`}
						>
							{proc.cpu}%
						</span>
					</div>
				))}
				{!data && (
					<div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
				)}
			</div>
		</div>
	);
}
