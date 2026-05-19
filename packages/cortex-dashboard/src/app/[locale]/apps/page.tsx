import { getAllServices } from "@/lib/db/service";
import { listBadgesForService } from "@/lib/db/service-badges";
import { getCurrentSession } from "@/lib/auth";
import { AppsPanel } from "@/components/apps/apps-panel";

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
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold text-white/90 light:text-slate-800">
				Apps
			</h1>
			<AppsPanel services={withBadges} isAdmin={isAdmin} />
		</div>
	);
}

export const dynamic = "force-dynamic";
