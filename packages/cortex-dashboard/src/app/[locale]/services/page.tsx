import { getAllServicesForAdmin } from "@/lib/db/service";
import { AdminServicesTable } from "@/components/admin/admin-services-table";

export default async function ServicesPage() {
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
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Services</h1>
			<AdminServicesTable services={minimal} />
		</div>
	);
}

export const dynamic = "force-dynamic";
