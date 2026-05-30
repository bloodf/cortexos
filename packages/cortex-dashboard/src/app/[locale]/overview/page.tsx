import { OverviewDashboard } from "@/components/overview-dashboard";
import { queryOne } from "@/lib/db/client";
import type { LayoutConfig } from "@/components/layout/types";
import { PageHeader } from "@/components/ui/page-header";
import { LayoutDashboard } from "lucide-react";

const DEFAULT_LAYOUT = {
	rows: [
		{ items: ["cpu-gauge", "cpu-temperature", "memory-gauge", "storage-gauge"] },
		{ items: ["machine-sensors"] },
		{ items: ["service-online", "service-offline", "service-idle"] },
		{ items: ["uptime", "docker-status", "alerts"] },
		{ items: ["live-performance", "top-processes"] },
		{ items: ["network-graph"] },
		{ items: ["total-download", "total-upload"] },
	],
};

async function getInitialLayout() {
	try {
		const row = await queryOne<{ layout: unknown }>(
			"SELECT layout FROM dashboard_layouts WHERE user_id = 1",
		);
		return row?.layout ?? DEFAULT_LAYOUT;
	} catch {
		return DEFAULT_LAYOUT;
	}
}

export default async function OverviewPage() {
	const initialLayout = await getInitialLayout();

	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Overview"
				description="System health, service status, and live performance at a glance."
				icon={<LayoutDashboard />}
			/>
			<OverviewDashboard initialLayout={initialLayout as LayoutConfig} />
		</div>
	);
}
