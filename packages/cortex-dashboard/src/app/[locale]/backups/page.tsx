"use client";

import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, Clock, HardDrive } from "lucide-react";

export default function BackupsPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Backups"
				description="Backup jobs and snapshot management."
				actions={
					<Button>
						<Archive className="mr-2 h-4 w-4" />
						Create Backup
					</Button>
				}
			/>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Backups</CardTitle>
						<HardDrive className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">12</div>
						<p className="text-xs text-muted-foreground">Across 3 jobs</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Last Backup</CardTitle>
						<Clock className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">2h ago</div>
						<p className="text-xs text-muted-foreground">Successful</p>
					</CardContent>
				</Card>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Backup Jobs</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8 text-muted-foreground">
						Backup API integration pending — this page displays backup jobs
						from the NAS and local snapshot system.
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
