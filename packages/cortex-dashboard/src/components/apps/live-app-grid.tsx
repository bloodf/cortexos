"use client";

import useSWR from "swr";
import { AppGrid } from "./app-grid";
import type { ServiceData } from "@/components/services";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface LiveAppGridProps {
	initialServices: ServiceData[];
}

export function LiveAppGrid({ initialServices }: LiveAppGridProps) {
	const { data } = useSWR("/api/services", fetcher, { refreshInterval: 5000 });
	const liveServices: ServiceData[] | undefined = data?.services;

	const merged = liveServices
		? initialServices.map((s) => {
				const live = liveServices.find((ls: ServiceData) => ls.slug === s.slug);
				if (!live) return s;
				return { ...s, status: live.status, responseTime: live.responseTime };
			})
		: initialServices;

	return <AppGrid services={merged} />;
}
