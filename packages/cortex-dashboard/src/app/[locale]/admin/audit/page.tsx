import { AuditLogTable } from "@/components/admin/audit-log-table";
import { PageHeader } from "@/components/ui/page-header";
import { ScrollText } from "lucide-react";

export default function AdminAuditPage() {
	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Audit Log"
				description="Hash-chained record of every tool call, approval, and root-helper command. Filter by tool, class, decision, or result."
				icon={<ScrollText />}
			/>
			<AuditLogTable />
		</div>
	);
}

export const dynamic = "force-dynamic";
