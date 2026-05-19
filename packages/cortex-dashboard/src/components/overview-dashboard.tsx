"use client";

import { useCallback, useState } from "react";
import { DraggableLayout } from "@/components/draggable-layout";
import type { LayoutConfig } from "@/components/layout/types";

interface OverviewDashboardProps {
	initialLayout: LayoutConfig;
}

export function OverviewDashboard({ initialLayout }: OverviewDashboardProps) {
	const [layout, setLayout] = useState<LayoutConfig>(initialLayout);

	const handleLayoutChange = useCallback((newLayout: LayoutConfig) => {
		setLayout(newLayout);
		fetch("/api/layout", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ layout: newLayout }),
		}).catch(() => {});
	}, []);

	return (
		<div className="animate-[slide-in_0.4s_ease-out]">
			<DraggableLayout layout={layout} onChange={handleLayoutChange} />
		</div>
	);
}
