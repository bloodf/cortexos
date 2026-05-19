"use client";

import { cn } from "@/lib/utils";

export function StatusBadge({
	status,
	responseTime,
	className,
}: {
	status: string;
	responseTime: number;
	className?: string;
}) {
	const isOnline = status === "online";
	const isOffline = status === "offline";

	const containerClass = isOnline
		? "bg-emerald-500/10"
		: isOffline
			? "bg-red-500/10"
			: "bg-amber-500/10";

	const dotClass = isOnline
		? "bg-emerald-400 animate-pulse"
		: isOffline
			? "bg-red-400"
			: "bg-amber-400";

	const textClass = isOnline
		? "text-emerald-400"
		: isOffline
			? "text-red-400"
			: "text-amber-400";

	const label = isOnline ? "Online" : isOffline ? "Offline" : "Unknown";

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<div
				className={`relative flex items-center justify-center w-5 h-5 rounded-full ${containerClass}`}
			>
				<div className={`w-2 h-2 rounded-full ${dotClass}`} />
				{isOnline && (
					<div className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-30" />
				)}
			</div>
			<span className={`text-[10px] font-medium ${textClass}`}>{label}</span>
			{isOnline && responseTime > 0 && (
				<span className="text-[9px] text-white/30 light:text-slate-700 font-mono">
					{responseTime}ms
				</span>
			)}
		</div>
	);
}
