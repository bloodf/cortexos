"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ActivityIcon, ArrowDownIcon, ArrowUpIcon, NetworkIcon } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { NetChart } from "@/components/net-chart";

interface NetInterface {
	name: string;
	rxKbps: number;
	txKbps: number;
	rxBytesTotal: number;
	txBytesTotal: number;
}

interface NetPoint {
	time: string;
	rx: number;
	tx: number;
}

const HISTORY_LIMIT = 60;

function formatRate(kbps: number): string {
	if (kbps > 1024) return `${(kbps / 1024).toFixed(2)} MB/s`;
	return `${kbps.toFixed(1)} KB/s`;
}

function formatBytes(bytes: number): string {
	if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
	if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
	if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
	return `${bytes} B`;
}

export default function NetworkPage() {
	const t = useTranslations("Infrastructure");
	const [interfaces, setInterfaces] = useState<NetInterface[]>([]);
	const [history, setHistory] = useState<NetPoint[]>([]);
	const [loading, setLoading] = useState(true);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		const fetchData = async () => {
			try {
				const res = await fetch("/api/network", { cache: "no-store" });
				if (!res.ok || !mountedRef.current) return;
				const data = await res.json();
				const list: NetInterface[] = Array.isArray(data.interfaces)
					? data.interfaces
					: [];
				setInterfaces(list);
				setLoading(false);
				const rxTotal = list.reduce((s, i) => s + i.rxKbps, 0);
				const txTotal = list.reduce((s, i) => s + i.txKbps, 0);
				const now = new Date();
				const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
				setHistory((prev) => {
					const next = [...prev, { time, rx: rxTotal, tx: txTotal }];
					return next.length > HISTORY_LIMIT
						? next.slice(next.length - HISTORY_LIMIT)
						: next;
				});
			} catch {
				// polling retries
			}
		};
		fetchData();
		const interval = setInterval(fetchData, 3000);
		return () => {
			mountedRef.current = false;
			clearInterval(interval);
		};
	}, []);

	const rxTotalKbps = interfaces.reduce((s, i) => s + i.rxKbps, 0);
	const txTotalKbps = interfaces.reduce((s, i) => s + i.txKbps, 0);
	const rxBytesTotal = interfaces.reduce((s, i) => s + i.rxBytesTotal, 0);
	const txBytesTotal = interfaces.reduce((s, i) => s + i.txBytesTotal, 0);

	const columns: ColumnDef<NetInterface>[] = [
		{
			accessorKey: "name",
			header: "Interface",
			cell: ({ row }) => (
				<span className="font-mono text-xs text-foreground">{row.original.name}</span>
			),
		},
		{
			accessorKey: "rxKbps",
			header: "RX",
			cell: ({ row }) => (
				<span className="font-mono text-xs text-chart-1">{formatRate(row.original.rxKbps)}</span>
			),
		},
		{
			accessorKey: "txKbps",
			header: "TX",
			cell: ({ row }) => (
				<span className="font-mono text-xs text-chart-2">{formatRate(row.original.txKbps)}</span>
			),
		},
		{
			accessorKey: "rxBytesTotal",
			header: t("TotalRx"),
			cell: ({ row }) => (
				<span className="font-mono text-xs text-muted-foreground">
					{formatBytes(row.original.rxBytesTotal)}
				</span>
			),
		},
		{
			accessorKey: "txBytesTotal",
			header: t("TotalTx"),
			cell: ({ row }) => (
				<span className="font-mono text-xs text-muted-foreground">
					{formatBytes(row.original.txBytesTotal)}
				</span>
			),
		},
	];

	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title={t("NetworkTitle")}
				description={t("NetworkDescription")}
				icon={<NetworkIcon />}
				actions={
					<span className="flex items-center gap-2 text-sm text-muted-foreground">
						<ActivityIcon className="size-4" />
						{interfaces.length} {t("Interfaces")}
					</span>
				}
			/>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<StatCard
					label={t("Inbound")}
					value={formatRate(rxTotalKbps)}
					icon={<ArrowDownIcon />}
				/>
				<StatCard
					label={t("Outbound")}
					value={formatRate(txTotalKbps)}
					icon={<ArrowUpIcon />}
				/>
				<StatCard label={t("TotalRx")} value={formatBytes(rxBytesTotal)} />
				<StatCard label={t("TotalTx")} value={formatBytes(txBytesTotal)} />
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t("ThroughputHistory")}</CardTitle>
				</CardHeader>
				<CardContent>
					<NetChart data={history} />
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>{t("Interfaces")}</CardTitle>
				</CardHeader>
				<CardContent>
					<DataTable
						columns={columns}
						data={interfaces}
						loading={loading}
						emptyState={<EmptyState title={t("NoInterfaces")} />}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
