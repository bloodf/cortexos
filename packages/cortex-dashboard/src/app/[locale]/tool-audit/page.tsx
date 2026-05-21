import { ActionLog } from "@/components/admin/action-log";

export default function AuditLogPage() {
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Action Log</h1>
			<p className="text-sm text-muted-foreground">Operator actions against systemd and Docker targets.</p>
			<ActionLog />
		</div>
	);
}

export const dynamic = "force-dynamic";
