"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ServiceSearch } from "@/components/services/service-search";
import { StatusBadge } from "@/components/services/status-badge";
import { ServiceLogo } from "@/components/service-logo";
import { fuzzyMatch } from "@/components/services/types";
import { CheckTypeBadge } from "./check-type-badge";
import { TriggerCheckButton } from "./trigger-check-button";

export interface HealthcheckService {
	id: number;
	slug: string;
	name: string;
	open_url: string;
	category: string;
	status: "online" | "offline" | "unknown";
	responseTime: number;
	icon_color: string | null;
	icon_image: string | null;
	health_type: "http" | "tcp" | "docker" | "process" | "systemd";
	health_url: string;
}

interface HealthcheckTableProps {
	services: HealthcheckService[];
	isMobile?: boolean;
}

type ViewMode = "cards" | "table";

export function HealthcheckTable({ services, isMobile = false }: HealthcheckTableProps) {
	const [search, setSearch] = useState("");
	const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? "cards" : "table");

	const filtered = useMemo(() => {
		let list = services;
		if (search) {
			list = list.filter((s) =>
				fuzzyMatch(search, s.name) ||
				fuzzyMatch(search, s.category) ||
				fuzzyMatch(search, s.health_url) ||
				fuzzyMatch(search, s.health_type),
			);
		}
		return [...list].sort((a, b) => {
			if (a.status === b.status) return a.name.localeCompare(b.name);
			if (a.status === "offline") return -1;
			if (b.status === "offline") return 1;
			if (a.status === "unknown") return -1;
			if (b.status === "unknown") return 1;
			return a.name.localeCompare(b.name);
		});
	}, [services, search]);

	const columns = useMemo<ColumnDef<HealthcheckService>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Name",
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<ServiceLogo serviceId={row.original.slug} size={32} iconColor={row.original.icon_color} iconImage={row.original.icon_image} />
						<span className="text-sm font-medium">{row.original.name}</span>
					</div>
				),
			},
			{
				accessorKey: "health_type",
				header: "Check Type",
				cell: ({ row }) => <CheckTypeBadge type={row.original.health_type} />,
			},
			{
				accessorKey: "health_url",
				header: "Target",
				cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.health_url}</span>,
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => <StatusBadge status={row.original.status} responseTime={row.original.responseTime} />,
			},
			{
				accessorKey: "responseTime",
				header: "Response Time",
				cell: ({ row }) => <span className="font-mono text-xs">{row.original.responseTime > 0 ? `${row.original.responseTime}ms` : "—"}</span>,
			},
			{
				id: "actions",
				header: "Actions",
				cell: ({ row }) => <TriggerCheckButton serviceId={row.original.id} healthType={row.original.health_type} />,
			},
		],
		[],
	);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between gap-3">
				<ServiceSearch value={search} onChange={setSearch} placeholder="Search services..." />
				<div className="flex rounded-md border border-border p-0.5">
					<Button type="button" size="sm" variant={viewMode === "cards" ? "secondary" : "ghost"} onClick={() => setViewMode("cards")} aria-label="Card view">
						<LayoutGrid className="size-4" />
					</Button>
					<Button type="button" size="sm" variant={viewMode === "table" ? "secondary" : "ghost"} onClick={() => setViewMode("table")} aria-label="Table view">
						<List className="size-4" />
					</Button>
				</div>
			</div>

			{filtered.length === 0 ? (
				<div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">No services match your filter</div>
			) : viewMode === "cards" ? (
				<div className="flex flex-col gap-3">
					{filtered.map((s) => (
						<div key={s.slug} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<ServiceLogo serviceId={s.slug} size={36} iconColor={s.icon_color} iconImage={s.icon_image} />
									<div className="flex flex-col">
										<span className="text-sm font-medium">{s.name}</span>
										<span className="text-xs text-muted-foreground">{s.health_url}</span>
									</div>
								</div>
								<TriggerCheckButton serviceId={s.id} healthType={s.health_type} />
							</div>
							<div className="flex items-center justify-between">
								<CheckTypeBadge type={s.health_type} />
								<StatusBadge status={s.status} responseTime={s.responseTime} />
							</div>
						</div>
					))}
				</div>
			) : (
				<DataTable columns={columns} data={filtered} noPagination />
			)}
		</div>
	);
}
