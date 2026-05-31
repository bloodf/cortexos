import { AdminDashboard } from "@/components/sys-pilot/admin/admin-dashboard";
import { getAllServicesForAdmin } from "@/lib/db/service";

export default async function AdminPage() {
	const services = await getAllServicesForAdmin();
	return <AdminDashboard services={services} />;
}

export const dynamic = "force-dynamic";
