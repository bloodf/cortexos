"use client";

import * as React from "react";
import { useSearchParams, usePathname } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { ServiceLogo } from "@/components/service-logo";
import { StatusBadge } from "@/components/services/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ExternalLink, Eye, LayoutGrid, List, Settings2 } from "lucide-react";
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
	credentials?: { username?: string; password?: string; note?: string } | null;
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
	const [viewMode, setViewMode] = React.useState<"cards" | "table">("cards");

	const selectedBadges = React.useMemo(() => {
		const raw = searchParams.get("badges");
		if (!raw) return new Set<string>();
		return new Set(raw.split(",").filter(Boolean));
	}, [searchParams]);

	const { data } = useSWR<{ services: { slug: string; status: string; responseTime: number }[] }>("/api/services", fetcher, { refreshInterval: 5000 });
	const live = data?.services ?? [];
	const merged = services.map((s) => {
		const l = live.find((ls) => ls.slug === s.slug);
		return l ? { ...s, status: (l.status as AppService["status"]) ?? s.status, responseTime: l.responseTime ?? s.responseTime } : s;
	});

	const allBadges = React.useMemo(() => {
		const map = new Map<string, { slug: string; label: string; color: string; count: number }>();
		for (const s of services) for (const b of s.badges) {
			const existing = map.get(b.slug);
			if (existing) existing.count++;
			else map.set(b.slug, { ...b, count: 1 });
		}
		return Array.from(map.values()).sort((a, b) => a.slug.localeCompare(b.slug));
	}, [services]);

	const filtered = selectedBadges.size === 0 ? merged : merged.filter((s) => s.badges.some((b) => selectedBadges.has(b.slug)));

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

	const columns = React.useMemo<ColumnDef<AppService>[]>(() => [
		{ accessorKey: "name", header: "Name", cell: ({ row }) => <div className="flex items-center gap-3"><ServiceLogo serviceId={row.original.slug} serviceName={row.original.name} size={28} iconColor={row.original.icon_color} iconImage={row.original.icon_image} /><span className="font-medium">{row.original.name}</span></div> },
		{ accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} responseTime={row.original.responseTime} /> },
		{ accessorKey: "category", header: "Category" },
		{ id: "badges", header: "Badges", cell: ({ row }) => <BadgeList badges={row.original.badges} /> },
		{ id: "actions", header: "", cell: ({ row }) => <AppActions service={row.original} isAdmin={isAdmin} /> },
	], [isAdmin]);

	return (
		<div className="grid gap-4 md:grid-cols-[200px_1fr]">
			<aside className="space-y-2">
				<div className="flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Badges</h2>{selectedBadges.size > 0 && <button type="button" onClick={clearFilter} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>}</div>
				{allBadges.length === 0 ? <p className="text-xs text-muted-foreground">No badges defined.</p> : <ul className="space-y-1">{allBadges.map((b) => { const active = selectedBadges.has(b.slug); return <li key={b.slug}><button type="button" onClick={() => toggleBadge(b.slug)} className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors ${active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`} aria-pressed={active}><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: b.color }} />{b.label}</span><span className="text-[10px] text-muted-foreground">{b.count}</span></button></li>; })}</ul>}
			</aside>
			<section className="space-y-3">
				<div className="flex justify-end"><div className="flex rounded-md border border-border p-0.5"><Button type="button" size="sm" variant={viewMode === "cards" ? "secondary" : "ghost"} onClick={() => setViewMode("cards")} aria-label="Card view"><LayoutGrid className="size-4" /></Button><Button type="button" size="sm" variant={viewMode === "table" ? "secondary" : "ghost"} onClick={() => setViewMode("table")} aria-label="Table view"><List className="size-4" /></Button></div></div>
				{filtered.length === 0 ? <EmptyState title="No apps match" description={selectedBadges.size > 0 ? "Try clearing the badge filter." : "No services registered yet."} /> : viewMode === "table" ? <DataTable columns={columns} data={filtered} noPagination /> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((s) => <AppCard key={s.slug} service={s} isAdmin={isAdmin} />)}</div>}
			</section>
		</div>
	);
}

function BadgeList({ badges }: { badges: AppService["badges"] }) {
	return <div className="flex flex-wrap gap-1">{badges.map((b) => <Badge key={b.slug} variant="outline" className="text-[10px] px-1.5 py-0" style={{ borderColor: b.color, color: b.color }}>{b.label}</Badge>)}</div>;
}

function AppActions({ service: s, isAdmin }: { service: AppService; isAdmin: boolean }) {
	const router = useRouter();
	return <div className="flex justify-end gap-1">{s.open_url !== "#" && <a href={s.open_url} target="_blank" rel="noopener noreferrer"><IconButton tooltip={`Open ${s.name}`}><ExternalLink className="size-4" /></IconButton></a>}{isAdmin && s.credentials && <CredentialsDialog service={s} />}{isAdmin && s.env_source && <IconButton variant="ghost" tooltip={`View env for ${s.name}`} onClick={() => router.push(`/env-browser?path=${encodeURIComponent(s.env_source ?? "")}`)}><Settings2 className="size-4" /></IconButton>}</div>;
}

function CredentialsDialog({ service }: { service: AppService }) {
	const credentials = service.credentials;
	if (!credentials) return null;
	return (
		<Dialog>
			<DialogTrigger render={<IconButton variant="ghost" tooltip={`Show ${service.name} credentials`} />}>
				<Eye className="size-4" />
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{service.name} credentials</DialogTitle>
					<DialogDescription>Visible to dashboard administrators only.</DialogDescription>
				</DialogHeader>
				<div className="space-y-3">
					<CredentialRow label="Username" value={credentials.username} />
					<CredentialRow label="Password" value={credentials.password} />
					{credentials.note && <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{credentials.note}</p>}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function CredentialRow({ label, value }: { label: string; value?: string }) {
	return (
		<div className="space-y-1">
			<div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
			<div className="break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-sm">
				{value || "Not configured"}
			</div>
		</div>
	);
}

function AppCard({ service: s, isAdmin }: { service: AppService; isAdmin: boolean }) {
	return <div className="rounded-xl border border-border bg-card p-4 transition-all hover:bg-muted/40"><div className="flex items-start gap-3"><ServiceLogo serviceId={s.slug} serviceName={s.name} size={36} iconColor={s.icon_color} iconImage={s.icon_image} /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{s.name}</div><div className="mt-1.5"><StatusBadge status={s.status} responseTime={s.responseTime} /></div>{s.badges.length > 0 && <div className="mt-2"><BadgeList badges={s.badges} /></div>}</div></div><div className="mt-3 flex items-center justify-end gap-1"><AppActions service={s} isAdmin={isAdmin} /></div></div>;
}
