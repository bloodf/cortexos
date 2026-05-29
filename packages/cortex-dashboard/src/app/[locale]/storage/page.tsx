"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import { HardDrive } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";

interface MountInfo {
	filesystem: string;
	mount: string;
	total: string;
	used: string;
	free: string;
	percent: number;
}
interface DriveInfo {
	name: string;
	size: string;
	model: string;
	type: string;
}

function usageColor(pct: number): string {
	if (pct > 90) return "var(--destructive)";
	if (pct > 70) return "var(--warning)";
	return "var(--success)";
}

function usageTextClass(pct: number): string {
	if (pct > 90) return "text-destructive";
	if (pct > 70) return "text-warning";
	return "text-success";
}

export default function StoragePage() {
	const t = useTranslations("Infrastructure");
	const [mounts, setMounts] = useState<MountInfo[]>([]);
	const [drives, setDrives] = useState<DriveInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState("");
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		const fetchData = async () => {
			try {
				const res = await fetch("/api/system", { cache: "no-store" });
				if (res.ok && mountedRef.current) {
					const data = await res.json();
					setMounts(data.mounts || []);
					setDrives(data.drives || []);
					setLoading(false);
				}
			} catch {
				// polling retries in 5s
			}
		};
		fetchData();
		const interval = setInterval(fetchData, 5000);
		return () => {
			mountedRef.current = false;
			clearInterval(interval);
		};
	}, []);

	const columns: ColumnDef<MountInfo>[] = useMemo(
		() => [
			{
				accessorKey: "mount",
				header: "Mount",
				cell: ({ row }) => (
					<span className="font-mono text-xs text-foreground">{row.original.mount}</span>
				),
			},
			{
				accessorKey: "filesystem",
				header: "Filesystem",
				cell: ({ row }) => (
					<span className="text-xs text-muted-foreground">{row.original.filesystem}</span>
				),
			},
			{
				accessorKey: "total",
				header: "Size",
				cell: ({ row }) => (
					<span className="font-mono text-xs text-foreground">{row.original.total}</span>
				),
			},
			{
				accessorKey: "used",
				header: "Used",
				cell: ({ row }) => (
					<span className="font-mono text-xs text-foreground">{row.original.used}</span>
				),
			},
			{
				accessorKey: "free",
				header: "Free",
				cell: ({ row }) => (
					<span className="font-mono text-xs text-success">{row.original.free}</span>
				),
			},
			{
				accessorKey: "percent",
				header: "Usage",
				cell: ({ row }) => {
					const pct = row.original.percent || 0;
					return (
						<div className="flex items-center gap-2">
							<div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
								<div
									className="h-full rounded-full"
									style={{ width: `${pct}%`, backgroundColor: usageColor(pct) }}
								/>
							</div>
							<span className={`text-xs font-mono font-medium ${usageTextClass(pct)}`}>
								{pct}%
							</span>
						</div>
					);
				},
			},
		],
		[],
	);

	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title={t("StorageTitle")}
				description={t("StorageDescription")}
				icon={<HardDrive />}
			/>

			<Card>
				<CardHeader>
					<CardTitle>{t("PhysicalDrives")}</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						{drives.map((d) => (
							<div key={d.name} className="rounded-xl border border-border bg-muted/30 p-4">
								<div className="text-xs text-muted-foreground font-mono mb-1">{d.name}</div>
								<div className="text-sm font-medium text-foreground truncate" title={d.model}>
									{d.model}
								</div>
								<div className="flex items-center gap-2 mt-2">
									<span className="text-lg font-bold text-foreground">{d.size}</span>
									<Badge variant="secondary">{d.type}</Badge>
								</div>
							</div>
						))}
						{drives.length === 0 && !loading && (
							<div className="text-muted-foreground text-sm">{t("NoDrives")}</div>
						)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t("MountPoints")}</CardTitle>
				</CardHeader>
				<CardContent>
					<DataTable
						columns={columns}
						data={mounts}
						loading={loading}
						enableFilter
						globalFilter={filter}
						onGlobalFilterChange={setFilter}
						filterPlaceholder={t("SearchMounts")}
						emptyState={<EmptyState title={t("NoMounts")} />}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
