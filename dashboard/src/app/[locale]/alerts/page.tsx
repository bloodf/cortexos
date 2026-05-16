import { getAlertRules, getAlertHistory } from "@/lib/db/alerts";
import { AlertHistory } from "@/components/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BellIcon } from "lucide-react";

export default async function AlertsPage() {
	const rules = await getAlertRules();
	const history = await getAlertHistory(undefined, undefined, 20);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2">
				<BellIcon className="size-5" />
				<h1 className="text-xl font-bold">Alerts</h1>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Alert Rules</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{rules.length === 0 && (
						<p className="text-sm text-muted-foreground">No alert rules configured.</p>
					)}
					{rules.map((rule) => (
						<div
							key={rule.id}
							className="flex items-center justify-between rounded-lg border p-3"
						>
							<div>
								<p className="text-sm font-medium">{rule.name}</p>
								<p className="text-xs text-muted-foreground">
									Condition: {rule.condition}
									{rule.threshold_ms ? ` > ${rule.threshold_ms}ms` : ""}
								</p>
							</div>
							<Badge variant={rule.enabled ? "default" : "secondary"}>
								{rule.enabled ? "Enabled" : "Disabled"}
							</Badge>
						</div>
					))}
				</CardContent>
			</Card>

			<AlertHistory limit={20} />
		</div>
	);
}
