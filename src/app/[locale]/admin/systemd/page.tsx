import { AdminSystemdTable } from "@/components/admin/admin-systemd-table";

export default function AdminSystemdPage() {
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Admin · Systemd</h1>
			<p className="text-sm text-muted-foreground">
				Manage systemd units on the host. Start/stop/restart actions require confirmation
				and are audit-logged.
			</p>
			<AdminSystemdTable />
		</div>
	);
}

export const dynamic = "force-dynamic";
