import { listAlerts, getAlertRules } from "@/lib/db/alerts";
import { AdminAlertsPanel } from "@/components/admin/admin-alerts-panel";

export default async function AdminAlertsPage() {
	const [alerts, rules] = await Promise.all([
		listAlerts({ limit: 100 }),
		getAlertRules(),
	]);
	const safeAlerts = alerts.map((a) => ({
		id: a.id,
		kind: a.kind,
		severity: a.severity,
		title: a.title,
		body: a.body,
		source: a.source,
		acknowledged_at: a.acknowledged_at ? a.acknowledged_at.toISOString() : null,
		created_at: a.created_at.toISOString(),
	}));
	const safeRules = rules.map((r) => ({
		id: r.id,
		service_id: r.service_id,
		name: r.name,
		condition: r.condition,
		threshold_ms: r.threshold_ms,
		enabled: r.enabled,
	}));
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Admin · Alerts</h1>
			<p className="text-sm text-muted-foreground">
				Operational alerts and rule management. Acknowledge or delete alerts; toggle rules.
			</p>
			<AdminAlertsPanel initialAlerts={safeAlerts} initialRules={safeRules} />
		</div>
	);
}

export const dynamic = "force-dynamic";
