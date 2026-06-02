"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Archive, Clock, HardDrive } from "lucide-react";
import { api } from "@/lib/api";

function formatBytes(n: number): string {
	if (!n) return "0 B";
	const u = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
	return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

export default function BackupsPage() {
	const { data: backups = [], isLoading } = useQuery({
		queryKey: ["backups"],
		queryFn: api.backups,
		refetchInterval: 30000,
	});
	const totalSize = backups.reduce((s, b) => s + (b.size || 0), 0);
	const last = backups[0]; // route returns newest first

	return (
		<div className="space-y-6">
			<PageHeader
				title="Backups"
				description="Encrypted full backups produced by the cortex-backup timer (twice daily), stored on the NAS."
			/>
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Total Backups</CardTitle>
						<HardDrive className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{backups.length}</div>
						<p className="text-xs text-muted-foreground">{formatBytes(totalSize)} on disk</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-sm font-medium">Last Backup</CardTitle>
						<Clock className="size-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-bold">{last ? new Date(last.created_at).toLocaleDateString() : "—"}</div>
						<p className="text-xs text-muted-foreground">{last ? new Date(last.created_at).toLocaleTimeString() : "no backups found"}</p>
					</CardContent>
				</Card>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Backup Archives</CardTitle>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="text-center py-8 text-muted-foreground">Loading…</div>
					) : backups.length === 0 ? (
						<div className="text-center py-8 text-muted-foreground">No backups found — check the NAS mount and the cortex-backup timer.</div>
					) : (
						<div className="divide-y">
							{backups.map((b) => (
								<div key={b.id} className="flex items-center justify-between gap-4 py-2.5">
									<div className="flex min-w-0 items-center gap-2">
										<Archive className="size-4 shrink-0 text-muted-foreground" />
										<span className="truncate font-mono text-sm">{b.name}</span>
									</div>
									<div className="flex shrink-0 items-center gap-4 text-sm tabular-nums text-muted-foreground">
										<span>{formatBytes(b.size)}</span>
										<span>{new Date(b.created_at).toLocaleString()}</span>
										<Badge variant={b.status === "done" ? "default" : "outline"} className="text-[10px]">{b.status}</Badge>
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
