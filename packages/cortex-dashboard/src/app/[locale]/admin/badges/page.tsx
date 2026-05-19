import { listBadges } from "@/lib/db/badges";
import { AdminBadgesGrid } from "@/components/admin/admin-badges-grid";

export default async function AdminBadgesPage() {
	const badges = await listBadges();
	const safe = badges.map((b) => ({
		id: b.id,
		slug: b.slug,
		label: b.label,
		color: b.color,
		text_color: b.text_color,
	}));
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Admin · Badges</h1>
			<AdminBadgesGrid initialBadges={safe} />
		</div>
	);
}

export const dynamic = "force-dynamic";
