import { listBadges } from "@/lib/db/badges";
import { AdminBadgesGrid } from "@/components/admin/admin-badges-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Tags } from "lucide-react";

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
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Badges"
				description="Reusable labels for tagging services across the catalog."
				icon={<Tags />}
			/>
			<AdminBadgesGrid initialBadges={safe} />
		</div>
	);
}

export const dynamic = "force-dynamic";
