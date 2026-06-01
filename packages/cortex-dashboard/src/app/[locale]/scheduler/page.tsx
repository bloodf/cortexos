"use client";

import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Play } from "lucide-react";

export default function SchedulerPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Scheduler"
				description="Cron jobs and scheduled tasks."
				actions={
					<Button>
						<Calendar className="mr-2 h-4 w-4" />
						New Schedule
					</Button>
				}
			/>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
						<Play className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">8</div>
						<p className="text-xs text-muted-foreground">3 disabled</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Next Run</CardTitle>
						<Clock className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">5m</div>
						<p className="text-xs text-muted-foreground">Auto-backup</p>
					</CardContent>
				</Card>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Scheduled Jobs</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8 text-muted-foreground">
						Scheduler API integration pending — this page will read from
						 systemd timers and cron entries.
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
