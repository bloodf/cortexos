"use client";

import useSWR from "swr";
import { HealthcheckTable, type HealthcheckService } from "./healthcheck-table";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface LiveHealthcheckTableProps {
	initialServices: HealthcheckService[];
}

export function LiveHealthcheckTable({ initialServices }: LiveHealthcheckTableProps) {
	const { data } = useSWR("/api/services?healthcheck=true", fetcher, { refreshInterval: 5000 });
	const liveServices: HealthcheckService[] | undefined = data?.services;

	const merged = liveServices
		? initialServices.map((s) => {
				const live = liveServices.find((ls: HealthcheckService) => ls.id === s.id);
				if (!live) return s;
				return {
					...s,
					status: live.status,
					responseTime: live.responseTime,
				};
			})
		: initialServices;

	return <HealthcheckTable services={merged} />;
}
