"use client";

import { MemoryStick } from "lucide-react";
import { Gauge } from "@/components/gauge";
import { useSystemData } from "@/hooks/use-dashboard-data";

export function MemoryGaugeWidget() {
	const { data: sys } = useSystemData();
	return (
		<div className="h-full flex flex-col items-center justify-center min-h-[200px]">
			{sys ? (
				<Gauge
					value={sys.memory.percent}
					color="var(--chart-3)"
					label="Memory"
					sublabel={`${sys.memory.used} / ${sys.memory.total} MB`}
					icon={<MemoryStick className="w-5 h-5" />}
				/>
			) : (
				<div className="animate-pulse bg-white/[0.04] rounded-full w-32 h-32" />
			)}
		</div>
	);
}
