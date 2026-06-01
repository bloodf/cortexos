"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TriangleAlertIcon, CircleCheckIcon, ClockIcon, BellOffIcon } from "lucide-react";

interface AlertHistoryItem {
	id: number;
	rule_id: number;
	service_id: number;
	status: string;
	message: string;
	created_at: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function AlertHistory({ limit = 50 }: { limit?: number }) {
	const { data, isLoading } = useSWR<{ history: AlertHistoryItem[] }>(
		`/api/alerts?history=1&limit=${limit}`,
		fetcher,
	);
	const history = data?.history || [];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<ClockIcon className="size-4" />
					Alert History
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{isLoading && (
					<>
						<Skeleton className="h-10 w-full" />
					</>
				)}
				{!isLoading && history.length === 0 && (
					<EmptyState
						icon={<BellOffIcon />}
						title="No alerts yet"
						description="Triggered alerts will appear here as services change state."
					/>
				)}
				{history.map((item) => {
					const offline = item.status === "offline";
					return (
						<div
							key={item.id}
							className="flex items-start gap-3 rounded-lg border border-border p-3"
						>
							{offline ? (
								<TriangleAlertIcon className="size-4 text-destructive mt-0.5 shrink-0" />
							) : (
								<CircleCheckIcon className="size-4 text-success mt-0.5 shrink-0" />
							)}
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-foreground">{item.message}</p>
								<p className="text-xs text-muted-foreground">
									{new Date(item.created_at).toLocaleString()}
								</p>
							</div>
							<Badge
								className={
									offline
										? "bg-destructive/10 text-destructive"
										: "bg-success/10 text-success"
								}
							>
								{item.status}
							</Badge>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
