"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
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
	health_type: "http" | "tcp" | "docker" | "process";
	health_url: string;
}

interface HealthcheckTableProps {
	services: HealthcheckService[];
	isMobile?: boolean;
}

export function HealthcheckTable({ services, isMobile = false }: HealthcheckTableProps) {
	const [search, setSearch] = useState("");

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

	if (sorted.length === 0) {
		return (
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between gap-3">
					<ServiceSearch
						value={search}
						onChange={setSearch}
						placeholder="Search services..."
					/>
				</div>
				<div className="text-center text-white/20 light:text-slate-700 py-12 text-sm rounded-lg border border-border">
					No services match your filter
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between gap-3">
				<ServiceSearch
					value={search}
					onChange={setSearch}
					placeholder="Search services..."
				/>
			</div>

			{isMobile ? (
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
								className="rounded-lg border border-border bg-white/[0.02] p-4 flex flex-col gap-3"
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
											<span className="text-sm font-medium text-white/80 light:text-slate-700">
												{s.name}
											</span>
											<span className="text-xs text-white/40 light:text-slate-500">
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
				<div className="rounded-lg border border-border overflow-hidden">
					<Table className="w-full text-left">
						<TableHeader>
							<TableRow className="border-b border-border bg-white/[0.02]">
								<TableHead className="py-3 px-4 text-xs font-medium text-white/40 light:text-slate-500 uppercase tracking-wider">
									Name
								</TableHead>
								<TableHead className="py-3 px-4 text-xs font-medium text-white/40 light:text-slate-500 uppercase tracking-wider">
									Check Type
								</TableHead>
								<TableHead className="py-3 px-4 text-xs font-medium text-white/40 light:text-slate-500 uppercase tracking-wider">
									Target
								</TableHead>
								<TableHead className="py-3 px-4 text-xs font-medium text-white/40 light:text-slate-500 uppercase tracking-wider">
									Status
								</TableHead>
								<TableHead className="py-3 px-4 text-xs font-medium text-white/40 light:text-slate-500 uppercase tracking-wider">
									Response Time
								</TableHead>
								<TableHead className="py-3 px-4 text-xs font-medium text-white/40 light:text-slate-500 uppercase tracking-wider">
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
										className="border-b border-border hover:bg-white/[0.02] transition-colors"
									>
										<TableCell className="py-3 px-4">
											<div className="flex items-center gap-3">
												<ServiceLogo
													serviceId={s.slug}
													size={32}
													iconColor={s.icon_color}
													iconImage={s.icon_image}
												/>
												<span className="text-sm text-white/80 light:text-slate-700">
													{s.name}
												</span>
											</div>
										</TableCell>
										<TableCell className="py-3 px-4">
											<CheckTypeBadge type={s.health_type} />
										</TableCell>
										<TableCell className="py-3 px-4 text-sm text-white/60 light:text-slate-500">
											{s.health_url}
										</TableCell>
										<TableCell className="py-3 px-4">
											<StatusBadge
												status={s.status}
												responseTime={s.responseTime}
											/>
										</TableCell>
										<TableCell className="py-3 px-4 text-sm font-mono text-white/40 light:text-slate-500">
											{s.responseTime > 0 ? `${s.responseTime}ms` : "—"}
										</TableCell>
										<TableCell className="py-3 px-4">
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
	);
}
