import { getAlertRules } from "@/lib/db/alerts";
import { AlertHistory } from "@/components/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { BellIcon, BellOffIcon } from "lucide-react";

export default async function AlertsPage() {
	const rules = await getAlertRules();

	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title="Alerts"
				description="Notification rules and recent alert activity for monitored services."
				icon={<BellIcon />}
			/>

			<Card>
				<CardHeader>
					<CardTitle>Alert Rules</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{rules.length === 0 ? (
						<EmptyState
							icon={<BellOffIcon />}
							title="No alert rules configured"
							description="Add a rule to get notified when a service goes offline or slows down."
						/>
					) : (
						rules.map((rule) => (
							<div
								key={rule.id}
								className="flex items-center justify-between rounded-lg border border-border p-3"
							>
								<div>
									<p className="text-sm font-medium text-foreground">{rule.name}</p>
									<p className="text-xs text-muted-foreground">
										Condition: {rule.condition}
										{rule.threshold_ms ? ` > ${rule.threshold_ms}ms` : ""}
									</p>
								</div>
								<Badge variant={rule.enabled ? "default" : "secondary"}>
									{rule.enabled ? "Enabled" : "Disabled"}
								</Badge>
							</div>
						))
					)}
				</CardContent>
			</Card>

			<AlertHistory limit={20} />
		</div>
	);
}
