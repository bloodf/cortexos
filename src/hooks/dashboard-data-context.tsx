"use client";

import { createContext, type ReactNode } from "react";
import { useDashboardData } from "./use-dashboard-data";
import type { SystemData, ServiceCheck, ProcessInfo, NetworkData } from "./use-dashboard-data";

interface DashboardDataContextValue {
	system: SystemData | undefined;
	services: ServiceCheck[] | undefined;
	processes: ProcessInfo[] | undefined;
	network: NetworkData | undefined;
	docker: unknown;
	connected: boolean;
	isLoading: boolean;
	error: unknown;
}

export const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
	const data = useDashboardData();
	return (
		<DashboardDataContext.Provider value={data}>
			{children}
		</DashboardDataContext.Provider>
	);
}
