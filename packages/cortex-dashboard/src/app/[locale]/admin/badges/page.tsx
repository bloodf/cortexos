import { listBadges } from "@/lib/db/badges";
import { query } from "@/lib/db/client";
import { AdminBadgesGrid } from "@/components/admin/admin-badges-grid";

type BadgeUsage = { badge_id: number; usage_count: string | number };

export default async function AdminBadgesPage() {
	const badges = await listBadges();
	const usageRows = await query<BadgeUsage>("SELECT badge_id, COUNT(*) AS usage_count FROM service_badges GROUP BY badge_id");
	const usage = new Map(usageRows.map((row) => [row.badge_id, Number(row.usage_count)]));
	const safe = badges.map((b) => ({
		id: b.id,
		slug: b.slug,
		label: b.label,
		color: b.color,
		text_color: b.text_color,
		usage_count: usage.get(b.id) ?? 0,
	}));
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Admin · Badges</h1>
			<AdminBadgesGrid initialBadges={safe} />
		</div>
	);
}

export const dynamic = "force-dynamic";
