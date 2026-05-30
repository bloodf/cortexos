"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, CheckCircle2, Gauge, XCircle } from "lucide-react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
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

export function HealthcheckTable({ services, isMobile = false }: HealthcheckTableProps) {
	const [search, setSearch] = useState("");

	const stats = useMemo(() => {
		const online = services.filter((s) => s.status === "online");
		const offline = services.filter((s) => s.status === "offline").length;
		const responding = online.filter((s) => s.responseTime > 0);
		const avg = responding.length
			? Math.round(
					responding.reduce((sum, s) => sum + s.responseTime, 0) /
						responding.length,
				)
			: 0;
		return { online: online.length, offline, avg };
	}, [services]);

	const filtered = useMemo(() => {
		let list = services;
		if (search) {
			list = list.filter(
				(s) => fuzzyMatch(search, s.name) || fuzzyMatch(search, s.category),
			);
		}
		return list;
	}, [services, search]);

	const sorted = useMemo(() => {
		return [...filtered].sort((a, b) => {
			if (a.status === b.status) return 0;
			if (a.status === "offline") return -1;
			if (b.status === "offline") return 1;
			if (a.status === "unknown") return -1;
			if (b.status === "unknown") return 1;
			return 0;
		});
	}, [filtered]);

	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-4 sm:grid-cols-3">
				<StatCard
					label="Online"
					value={stats.online}
					icon={<CheckCircle2 className="text-success" />}
				/>
				<StatCard
					label="Offline"
					value={stats.offline}
					icon={<XCircle className="text-destructive" />}
				/>
				<StatCard
					label="Avg response"
					value={stats.avg > 0 ? `${stats.avg}ms` : "—"}
					icon={<Gauge />}
				/>
			</div>

			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between gap-3">
					<ServiceSearch
						value={search}
						onChange={setSearch}
						placeholder="Search services..."
					/>
				</div>

				{sorted.length === 0 ? (
					<div className="rounded-lg border border-border">
						<EmptyState
							icon={<Activity />}
							title="No services match"
							description={
								search
									? "Try a different search term."
									: "Nothing is monitored yet."
							}
						/>
					</div>
				) : isMobile ? (
					<div className="flex flex-col gap-3">
						<AnimatePresence>
							{sorted.map((s) => (
								<motion.div
									key={s.slug}
									layout
									initial={{ opacity: 0, y: 8 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -8 }}
									transition={{ duration: 0.15 }}
									className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<ServiceLogo
												serviceId={s.slug}
												size={36}
												iconColor={s.icon_color}
												iconImage={s.icon_image}
											/>
											<div className="flex flex-col">
												<span className="text-sm font-medium text-foreground">
													{s.name}
												</span>
												<span className="text-xs text-muted-foreground">
													{s.health_url}
												</span>
											</div>
										</div>
										<TriggerCheckButton
											serviceId={s.id}
											healthType={s.health_type}
										/>
									</div>
									<div className="flex items-center justify-between">
										<CheckTypeBadge type={s.health_type} />
										<StatusBadge
											status={s.status}
											responseTime={s.responseTime}
										/>
									</div>
								</motion.div>
							))}
						</AnimatePresence>
					</div>
				) : (
					<div className="overflow-hidden rounded-lg border border-border">
						<Table className="w-full text-left">
							<TableHeader>
								<TableRow className="border-b border-border bg-muted/50">
									<TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
										Name
									</TableHead>
									<TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
										Check Type
									</TableHead>
									<TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
										Target
									</TableHead>
									<TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
										Status
									</TableHead>
									<TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
										Response Time
									</TableHead>
									<TableHead className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
										Actions
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<AnimatePresence>
									{sorted.map((s) => (
										<motion.tr
											key={s.slug}
											layout
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -8 }}
											transition={{ duration: 0.15 }}
											className="border-b border-border transition-colors hover:bg-muted/50"
										>
											<TableCell className="px-4 py-3">
												<div className="flex items-center gap-3">
													<ServiceLogo
														serviceId={s.slug}
														size={32}
														iconColor={s.icon_color}
														iconImage={s.icon_image}
													/>
													<span className="text-sm text-foreground">
														{s.name}
													</span>
												</div>
											</TableCell>
											<TableCell className="px-4 py-3">
												<CheckTypeBadge type={s.health_type} />
											</TableCell>
											<TableCell className="px-4 py-3 text-sm text-muted-foreground">
												{s.health_url}
											</TableCell>
											<TableCell className="px-4 py-3">
												<StatusBadge
													status={s.status}
													responseTime={s.responseTime}
												/>
											</TableCell>
											<TableCell className="px-4 py-3 font-mono text-sm text-muted-foreground">
												{s.responseTime > 0 ? `${s.responseTime}ms` : "—"}
											</TableCell>
											<TableCell className="px-4 py-3">
												<TriggerCheckButton
													serviceId={s.id}
													healthType={s.health_type}
												/>
											</TableCell>
										</motion.tr>
									))}
								</AnimatePresence>
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</div>
	);
}
