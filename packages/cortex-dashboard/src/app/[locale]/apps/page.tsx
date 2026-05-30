import { getAllServices } from "@/lib/db/service";
import { listBadgesForService } from "@/lib/db/service-badges";
import { getCurrentSession } from "@/lib/auth";
import { AppsPanel } from "@/components/apps/apps-panel";
import { PageHeader } from "@/components/ui/page-header";
import { LayoutGrid } from "lucide-react";

export default async function AppsPage() {
	const rawServices = await getAllServices();
	const session = await getCurrentSession();
	const isAdmin = session !== null;

	const withBadges = await Promise.all(
		rawServices
			.filter((s) => s.open_url !== "#")
			.map(async (s) => {
				const badges = await listBadgesForService(s.id).catch(() => []);
				return {
					id: s.id,
					slug: s.slug,
					name: s.name,
					open_url: s.open_url,
					category: s.category,
					status: "unknown" as const,
					responseTime: 0,
					icon_color: s.icon_color,
					icon_image: s.icon_image,
					env_source: s.env_source,
					badges: badges.map((b) => ({
						slug: b.slug,
						label: b.label,
						color: b.color,
					})),
				};
			}),
	);

	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Apps"
				description="Launch and filter every registered CortexOS service."
				icon={<LayoutGrid />}
			/>
			<AppsPanel services={withBadges} isAdmin={isAdmin} />
		</div>
	);
}

export const dynamic = "force-dynamic";
