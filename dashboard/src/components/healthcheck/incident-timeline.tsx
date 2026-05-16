"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface Incident {
	from_status: string;
	to_status: string;
	changed_at: string;
}

interface IncidentTimelineProps {
	incidents: Incident[];
	maxItems?: number;
}

function statusColor(status: string): string {
	switch (status) {
		case "online":
			return "bg-emerald-500";
		case "offline":
			return "bg-red-500";
		default:
			return "bg-amber-500";
	}
}

function statusBadgeVariant(
	status: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (status) {
		case "online":
			return "default";
		case "offline":
			return "destructive";
		default:
			return "secondary";
	}
}

export function IncidentTimeline({
	incidents,
	maxItems = 20,
}: IncidentTimelineProps) {
	const items = incidents.slice(0, maxItems);

	if (items.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-sm font-medium">Incidents</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">No incidents in recent history.</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm font-medium">Incidents</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{items.map((incident, idx) => (
					<div key={idx} className="flex items-start gap-3">
						<div className="flex flex-col items-center gap-1 pt-1">
							<div
								className={`h-2 w-2 rounded-full ${statusColor(incident.to_status)}`}
							/>
							{idx < items.length - 1 && (
								<div className="h-full w-px bg-border" />
							)}
						</div>
						<div className="flex flex-1 flex-col gap-0.5 pb-3">
							<div className="flex items-center gap-2">
								<Badge variant={statusBadgeVariant(incident.from_status)}>
									{incident.from_status}
								</Badge>
								<span className="text-muted-foreground">→</span>
								<Badge variant={statusBadgeVariant(incident.to_status)}>
									{incident.to_status}
								</Badge>
							</div>
							<time className="text-xs text-muted-foreground">
								{new Date(incident.changed_at).toLocaleString()}
							</time>
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}
