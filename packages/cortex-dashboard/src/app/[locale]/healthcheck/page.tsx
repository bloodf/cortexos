import { getAllServices } from "@/lib/db/service";
import { LiveHealthcheckTable } from "@/components/healthcheck/live-healthcheck-table";
import { PageHeader } from "@/components/ui/page-header";
import { Activity } from "lucide-react";

export default async function HealthcheckPage() {
	const rawServices = await getAllServices();
	const visibleServices = rawServices.filter((s) => s.show_in_healthcheck);

	const initialServices = visibleServices.map((s) => ({
		id: s.id,
		slug: s.slug,
		name: s.name,
		open_url: s.open_url,
		category: s.category,
		status: "unknown" as const,
		responseTime: 0,
		icon_color: s.icon_color,
		icon_image: s.icon_image,
		health_type: s.health_type,
		health_url: s.health_url,
	}));

	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Healthcheck"
				description="Live status, response times, and uptime for monitored services."
				icon={<Activity />}
			/>
			<LiveHealthcheckTable initialServices={initialServices} />
		</div>
	);
}
