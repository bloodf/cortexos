"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ServiceToggles } from "./service-toggles";
import { BadgeManager } from "./badge-manager";
import { SystemdServices } from "./systemd-services";
import type { Service } from "./service-row";

type Tab = "toggles" | "badges" | "systemd";

export interface AdminDashboardProps {
	services?: Service[];
	onToggle?: (id: number, active: boolean) => void;
}

export function AdminDashboard({ services = [], onToggle }: AdminDashboardProps) {
	const [tab, setTab] = useState<Tab>("toggles");
	const [serviceList, setServiceList] = useState<Service[]>(services);
	const [selectedServiceId, setSelectedServiceId] = useState<number>(services[0]?.id ?? 0);
	const selectedService = serviceList.find((service) => service.id === selectedServiceId) || serviceList[0];

	useEffect(() => {
		if (services.length > 0) return;
		let mounted = true;
		void fetch("/api/admin/services?all=1", { cache: "no-store" })
			.then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
			.then((data: { services?: Service[] }) => {
				if (!mounted) return;
				const next = data.services ?? [];
				setServiceList(next);
				setSelectedServiceId(next[0]?.id ?? 0);
			})
			.catch(() => undefined);
		return () => {
			mounted = false;
		};
	}, [services.length]);

	async function handleToggle(id: number, active: boolean) {
		setServiceList((current) => current.map((service) => (service.id === id ? { ...service, is_active: active } : service)));
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
			setServiceList((current) => current.map((service) => (service.id === id ? { ...service, is_active: !active } : service)));
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
