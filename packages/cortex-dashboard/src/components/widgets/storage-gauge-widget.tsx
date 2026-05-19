"use client";

import { HardDrive } from "lucide-react";
import { Gauge } from "@/components/gauge";
import { useSystemData } from "@/hooks/use-dashboard-data";
import type { DriveInfo } from "@/hooks/use-dashboard-data";

export function StorageGaugeWidget() {
	const { data: sys } = useSystemData();
	const physicalDrives = (sys?.drives ?? []).filter((d: DriveInfo) => d.type === "disk");

	return (
		<div className="h-full flex flex-col items-center justify-center min-h-[200px]">
			{sys ? (
				<div className="flex gap-6 flex-wrap justify-center">
					{physicalDrives.map((d: DriveInfo) => (
						<Gauge
							key={d.name}
							value={d.percent ?? 0}
							color="#f59e0b"
							label={d.name}
							sublabel={d.used && d.total ? `${d.used} / ${d.total}` : d.size}
							icon={<HardDrive className="w-5 h-5" />}
						/>
					))}
				</div>
			) : (
				<div className="animate-pulse bg-white/[0.04] rounded-full w-32 h-32" />
			)}
		</div>
	);
}
