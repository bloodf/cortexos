"use client";

import { Cpu } from "lucide-react";
import { Gauge } from "@/components/gauge";
import { useSystemData } from "@/hooks/use-dashboard-data";

export function CpuGaugeWidget() {
	const { data: sys } = useSystemData();
	return (
		<div className="h-full flex flex-col items-center justify-center min-h-[200px]">
			{sys ? (
				<Gauge
					value={sys.cpu}
					color="var(--success)"
					label="CPU"
					sublabel={`Load: ${sys.load.map((l) => l.toFixed(2)).join(" / ")}`}
					icon={<Cpu className="w-5 h-5" />}
				/>
			) : (
				<div className="h-32 w-32 animate-pulse rounded-full bg-muted" />
			)}
		</div>
	);
}
