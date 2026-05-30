import { getAllServicesForAdmin } from "@/lib/db/service";
import { AdminServicesTable } from "@/components/admin/admin-services-table";
import { PageHeader } from "@/components/ui/page-header";
import { Boxes } from "lucide-react";

export default async function AdminServicesPage() {
	const services = await getAllServicesForAdmin();
	const minimal = services.map((s) => ({
		id: s.id,
		slug: s.slug,
		name: s.name,
		kind: s.kind,
		status: s.status,
		env_source: s.env_source,
		is_active: s.is_active,
		badges: s.badges ?? [],
	}));
	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Services"
				description="Service catalog registered with the dashboard. Toggle availability and review badges and env sources."
				icon={<Boxes />}
			/>
			<AdminServicesTable services={minimal} />
		</div>
	);
}

export const dynamic = "force-dynamic";
