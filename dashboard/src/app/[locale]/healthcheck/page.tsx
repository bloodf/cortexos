import { getAllServices } from "@/lib/db/service";
import { LiveHealthcheckTable } from "@/components/healthcheck/live-healthcheck-table";

export default async function HealthcheckPage() {
	const rawServices = await getAllServices();

	const initialServices = rawServices.map((s) => ({
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
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Healthcheck</h1>
			<LiveHealthcheckTable initialServices={initialServices} />
		</div>
	);
}
