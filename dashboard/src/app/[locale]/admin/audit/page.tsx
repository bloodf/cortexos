import { AuditLogTable } from "@/components/admin/audit-log-table";

export default function AdminAuditPage() {
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Admin · Audit Log</h1>
			<AuditLogTable />
		</div>
	);
}

export const dynamic = "force-dynamic";
