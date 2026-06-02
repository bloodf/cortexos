"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Play } from "lucide-react";
import { api } from "@/lib/api";

export default function SchedulerPage() {
	const { data: jobs = [], isLoading } = useQuery({
		queryKey: ["scheduler"],
		queryFn: api.scheduler,
		refetchInterval: 10000,
	});

	const enabled = jobs.filter((j) => j.enabled);
	const next = enabled
		.filter((j) => j.next_run)
		.sort((a, b) => new Date(a.next_run).getTime() - new Date(b.next_run).getTime())[0];

	return (
		<div className="space-y-6">
			<PageHeader
				title="Scheduler"
				description="Scheduled jobs from the host's systemd timers."
			/>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Active Timers</CardTitle>
						<Play className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{enabled.length}</div>
						<p className="text-xs text-muted-foreground">{jobs.length - enabled.length} inactive</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Next Run</CardTitle>
						<Clock className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{next ? new Date(next.next_run).toLocaleTimeString() : "—"}</div>
						<p className="truncate text-xs text-muted-foreground">{next ? next.name : "no upcoming timers"}</p>
					</CardContent>
				</Card>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Scheduled Jobs ({jobs.length})</CardTitle>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="py-8 text-center text-muted-foreground">Loading…</div>
					) : jobs.length === 0 ? (
						<div className="py-8 text-center text-muted-foreground">No systemd timers found.</div>
					) : (
						<div className="divide-y">
							{jobs.map((j) => (
								<div key={j.id} className="flex items-center justify-between gap-4 py-2.5">
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">{j.name}</p>
										<p className="truncate text-xs text-muted-foreground">{j.schedule}</p>
									</div>
									<div className="flex shrink-0 items-center gap-4 text-sm tabular-nums text-muted-foreground">
										<span>{j.next_run ? new Date(j.next_run).toLocaleString() : "—"}</span>
										<Badge variant={j.enabled ? "default" : "outline"} className="text-[10px]">{j.enabled ? "Active" : "Inactive"}</Badge>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
