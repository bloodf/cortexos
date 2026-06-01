"use client";

import * as React from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { ServiceToggles } from "./service-toggles";
import { BadgeManager } from "./badge-manager";
import { SystemdServices } from "./systemd-services";
import type { Service } from "./service-row";

const fetcher = (url: string) =>
	fetch(url, { cache: "no-store" }).then((res) =>
		res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)),
	);

type Tab = "toggles" | "badges" | "systemd";

export interface AdminDashboardProps {
	services?: Service[];
	onToggle?: (id: number, active: boolean) => void;
}

export function AdminDashboard({ services = [], onToggle }: AdminDashboardProps) {
	const [tab, setTab] = React.useState<Tab>("toggles");
	// Track optimistic toggle overrides keyed by service id
	const [overrides, setOverrides] = React.useState<Map<number, Partial<Service>>>(new Map());
	const [selectedServiceId, setSelectedServiceId] = React.useState<number>(services[0]?.id ?? 0);

	// Only fetch when no services provided via props
	const { data: fetchedData } = useSWR<{ services?: Service[] }>(
		services.length > 0 ? null : "/api/admin/services?all=1",
		fetcher,
	);
	const fetched = fetchedData?.services ?? [];

	// Base list: props when available, otherwise fetched
	const baseList = services.length > 0 ? services : fetched;

	// Apply optimistic overrides on top of base list
	const serviceList = React.useMemo(() => {
		if (overrides.size === 0) return baseList;
		return baseList.map((s) => {
			const o = overrides.get(s.id);
			return o ? { ...s, ...o } : s;
		});
	}, [baseList, overrides]);

	const serviceMap = React.useMemo(() => new Map(serviceList.map((s) => [s.id, s])), [serviceList]);
	const selectedService = serviceMap.get(selectedServiceId) ?? serviceList[0];

	async function handleToggle(id: number, active: boolean) {
		setOverrides((prev) => new Map(prev).set(id, { is_active: active }));
		try {
			if (onToggle) {
				onToggle(id, active);
				return;
			}
			const res = await fetch("/api/admin/services", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, is_active: active }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
		} catch {
			// Revert on failure
			setOverrides((prev) => {
				const next = new Map(prev);
				next.delete(id);
				return next;
			});
		}
	}

	const tabs: { key: Tab; label: string }[] = [
		{ key: "toggles", label: "Service Toggles" },
		{ key: "badges", label: "Badge Manager" },
		{ key: "systemd", label: "Systemd Services" },
	];

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				{tabs.map((item) => (
					<Button key={item.key} type="button" variant={tab === item.key ? "default" : "outline"} size="sm" onClick={() => setTab(item.key)}>
						{item.label}
					</Button>
				))}
			</div>

			{tab !== "toggles" && serviceList.length > 1 && (
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-xs text-muted-foreground">Service:</span>
					{serviceList.map((svc) => (
						<Button key={svc.id} type="button" variant={selectedServiceId === svc.id ? "secondary" : "ghost"} size="sm" onClick={() => setSelectedServiceId(svc.id)}>
							{svc.name}
						</Button>
					))}
				</div>
			)}

			{tab === "toggles" && <ServiceToggles services={serviceList} onToggle={handleToggle} />}
			{tab === "badges" && selectedService && <BadgeManager serviceId={selectedService.id} />}
			{tab === "systemd" && <SystemdServices />}
		</div>
	);
}
