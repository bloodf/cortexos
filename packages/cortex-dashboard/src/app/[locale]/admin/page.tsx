import { AdminDashboard } from "@/components/sys-pilot/admin/admin-dashboard";
import { getAllServicesForAdmin } from "@/lib/db/service";
import type { Service as UIService } from "@/lib/types";

function toUIService(row: Awaited<ReturnType<typeof getAllServicesForAdmin>>[number]): UIService {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		open_url: row.open_url,
		category: row.category,
		status: (row.status === "online" || row.status === "offline") ? row.status : "unknown",
		responseTime: row.response_ms ?? 0,
		icon_color: row.icon_color ?? null,
		icon_image: row.icon_image ?? null,
		kind: row.kind,
		health_url: row.health_url,
		health_type: row.health_type,
		description: row.description,
		env_source: row.env_source,
		is_active: row.is_active,
		has_webui: row.has_webui,
		show_in_healthcheck: row.show_in_healthcheck,
		show_in_webui: row.show_in_webui,
		sort_order: row.sort_order,
		icon_type: row.icon_type,
		badges: (row.badges ?? []).map((b) => ({ slug: b.slug, label: b.label, color: b.color })),
	};
}

export default async function AdminPage() {
	const rows = await getAllServicesForAdmin();
	const services = rows.map(toUIService);
	return <AdminDashboard services={services} />;
}

export const dynamic = "force-dynamic";
