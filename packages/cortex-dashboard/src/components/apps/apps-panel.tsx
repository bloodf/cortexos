"use client";

import * as React from "react";
import { useSearchParams, usePathname } from "next/navigation";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ServiceLogo } from "@/components/service-logo";
import { StatusBadge } from "@/components/services/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ExternalLink, Settings2 } from "lucide-react";
import { useRouter } from "@/i18n/routing";

export interface AppService {
	id: number;
	slug: string;
	name: string;
	open_url: string;
	category: string;
	status: "online" | "offline" | "unknown";
	responseTime: number;
	icon_color: string | null;
	icon_image: string | null;
	env_source: string | null;
	badges: { slug: string; label: string; color: string }[];
}

interface Props {
	services: AppService[];
	isAdmin: boolean;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AppsPanel({ services, isAdmin }: Props) {
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();

	const selectedBadges = React.useMemo(() => {
		const raw = searchParams.get("badges");
		if (!raw) return new Set<string>();
		return new Set(raw.split(",").filter(Boolean));
	}, [searchParams]);

	const { data } = useSWR<{ services: { slug: string; status: string; responseTime: number }[] }>(
		"/api/services",
		fetcher,
		{ refreshInterval: 5000 },
	);
	const live = data?.services ?? [];

	const merged = services.map((s) => {
		const l = live.find((ls) => ls.slug === s.slug);
		if (!l) return s;
		return {
			...s,
			status: (l.status as AppService["status"]) ?? s.status,
			responseTime: l.responseTime ?? s.responseTime,
		};
	});

	// Build badge index from currently visible services
	const allBadges = React.useMemo(() => {
		const map = new Map<string, { slug: string; label: string; color: string; count: number }>();
		for (const s of services) {
			for (const b of s.badges) {
				const existing = map.get(b.slug);
				if (existing) existing.count++;
				else map.set(b.slug, { ...b, count: 1 });
			}
		}
		return Array.from(map.values()).sort((a, b) => a.slug.localeCompare(b.slug));
	}, [services]);

	const filtered = selectedBadges.size === 0
		? merged
		: merged.filter((s) => s.badges.some((b) => selectedBadges.has(b.slug)));

	function toggleBadge(slug: string) {
		const next = new Set(selectedBadges);
		if (next.has(slug)) next.delete(slug);
		else next.add(slug);
		const params = new URLSearchParams(searchParams.toString());
		if (next.size === 0) params.delete("badges");
		else params.set("badges", Array.from(next).join(","));
		const qs = params.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname);
	}

	function clearFilter() {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("badges");
		const qs = params.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname);
	}

	return (
		<div className="grid gap-4 md:grid-cols-[200px_1fr]">
			<aside className="space-y-2">
				<div className="flex items-center justify-between">
					<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Badges
					</h2>
					{selectedBadges.size > 0 && (
						<button
							type="button"
							onClick={clearFilter}
							className="text-[10px] text-muted-foreground hover:text-foreground"
						>
							Clear
						</button>
					)}
				</div>
				{allBadges.length === 0 ? (
					<p className="text-xs text-muted-foreground">No badges defined.</p>
				) : (
					<ul className="space-y-1">
						{allBadges.map((b) => {
							const active = selectedBadges.has(b.slug);
							return (
								<li key={b.slug}>
									<button
										type="button"
										onClick={() => toggleBadge(b.slug)}
										className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors ${
											active
												? "bg-secondary text-foreground"
												: "text-muted-foreground hover:bg-muted hover:text-foreground"
										}`}
										aria-pressed={active}
									>
										<span className="inline-flex items-center gap-1.5">
											<span
												className="size-2 rounded-full"
												style={{ backgroundColor: b.color }}
											/>
											{b.label}
										</span>
										<span className="text-[10px] text-muted-foreground">{b.count}</span>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</aside>

			<section>
				{filtered.length === 0 ? (
					<EmptyState
						title="No apps match"
						description={
							selectedBadges.size > 0
								? "Try clearing the badge filter."
								: "No services registered yet."
						}
					/>
				) : (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{filtered.map((s) => (
							<AppCard key={s.slug} service={s} isAdmin={isAdmin} />
						))}
					</div>
				)}
			</section>
		</div>
	);
}

function AppCard({ service: s, isAdmin }: { service: AppService; isAdmin: boolean }) {
	const router = useRouter();
	return (
		<div className="glass-panel rounded-xl border border-white/[0.04] p-4 hover:border-white/[0.1] hover:bg-white/[0.03] transition-all">
			<div className="flex items-start gap-3">
				<ServiceLogo
					serviceId={s.slug}
					size={36}
					iconColor={s.icon_color}
					iconImage={s.icon_image}
				/>
				<div className="min-w-0 flex-1">
					<div className="text-sm font-medium text-white/80 light:text-slate-700 truncate">
						{s.name}
					</div>
					<div className="mt-1.5">
						<StatusBadge status={s.status} responseTime={s.responseTime} />
					</div>
					{s.badges.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1">
							{s.badges.map((b) => (
								<Badge
									key={b.slug}
									variant="outline"
									className="text-[10px] px-1.5 py-0"
									style={{ borderColor: b.color, color: b.color }}
								>
									{b.label}
								</Badge>
							))}
						</div>
					)}
				</div>
			</div>
			<div className="mt-3 flex items-center justify-end gap-1">
				{s.open_url !== "#" ? (
					<a
						href={s.open_url}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={`Open ${s.name}`}
						className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
					>
						<ExternalLink className="size-3 mr-1" />
						Open
					</a>
				) : (
					<Button size="sm" variant="outline" disabled>
						<ExternalLink className="size-3 mr-1" />
						Open
					</Button>
				)}
				{isAdmin && s.env_source && (
					<Button
						size="sm"
						variant="ghost"
						aria-label={`View env for ${s.name}`}
						onClick={() => {
							router.push(`/admin/env-browser?path=${encodeURIComponent(s.env_source ?? "")}`);
						}}
					>
						<Settings2 className="size-3" />
					</Button>
				)}
			</div>
		</div>
	);
}
