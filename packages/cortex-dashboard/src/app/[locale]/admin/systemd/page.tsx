import { AdminSystemdTable } from "@/components/admin/admin-systemd-table";
import { PageHeader } from "@/components/ui/page-header";
import { Cog } from "lucide-react";

export default function AdminSystemdPage() {
	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Systemd"
				description="Manage systemd units on the host. Start/stop/restart actions require confirmation and are audit-logged."
				icon={<Cog />}
			/>
			<AdminSystemdTable />
		</div>
	);
}

export const dynamic = "force-dynamic";
