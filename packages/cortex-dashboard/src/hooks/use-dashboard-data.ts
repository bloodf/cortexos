import useSWR from "swr";

const REFRESH_INTERVAL_MS = 3000;

const fetcher = async (url: string) => {
	const res = await fetch(url, { cache: "no-store" });
	if (!res.ok) throw new Error(`Request failed with ${res.status}`);
	return res.json();
};

export interface ServiceCheck {
	id: number;
	slug: string;
	name: string;
	open_url: string;
	category: string;
	status: "online" | "offline" | "unknown";
	responseTime: number;
	icon_color: string | null;
	icon_image: string | null;
}

export interface NetworkInterface {
	name: string;
	rxKbps: number;
	txKbps: number;
	rxBytesTotal: number;
	txBytesTotal: number;
}

export interface NetworkData {
	interfaces: NetworkInterface[];
}

export interface DriveInfo {
	name: string;
	model: string;
	size: string;
	type?: string;
	mount?: string;
	used?: string;
	total?: string;
	percent?: number;
}

export interface MountInfo {
	filesystem: string;
	mount: string;
	total: string;
	used: string;
	free: string;
	percent: number;
}

export interface MachineSensor {
	id: string;
	label: string;
	value: number;
	unit: "celsius" | "rpm" | "volts";
	source: string;
}

export interface SystemData {
	cpu: number;
	memory: { percent: number; used: number; total: number };
	drives: DriveInfo[];
	mounts: MountInfo[];
	load: number[];
	uptime?: number;
	sensors?: {
		cpuTemperature: MachineSensor | null;
		temperatures: MachineSensor[];
		fans: MachineSensor[];
		voltages: MachineSensor[];
	};
}

export interface ProcessInfo {
	pid: number;
	user: string;
	command: string;
	cpu: number;
	mem: number;
}

export interface DashboardData {
	system: SystemData;
	services: ServiceCheck[];
	processes: ProcessInfo[];
	network: NetworkData;
	docker: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

export function useSystemData() {
	const swr = useSWR<SystemData>("/api/system", fetcher, {
		refreshInterval: REFRESH_INTERVAL_MS,
	});
	return { data: swr.data, isLoading: swr.isLoading, error: swr.error };
}

export function useServicesData() {
	const swr = useSWR<{ services: ServiceCheck[] }>("/api/services", fetcher, {
		refreshInterval: REFRESH_INTERVAL_MS,
	});
	const safeServices = Array.isArray(swr.data?.services) ? swr.data.services : [];
	return {
		data: { services: safeServices },
		isLoading: swr.isLoading,
		error: swr.error,
	};
}

export function useProcessesData() {
	const swr = useSWR<{ processes: ProcessInfo[] }>("/api/processes", fetcher, {
		refreshInterval: REFRESH_INTERVAL_MS,
	});
	const safeProcesses = Array.isArray(swr.data?.processes) ? swr.data.processes : [];
	return {
		data: { processes: safeProcesses },
		isLoading: swr.isLoading,
		error: swr.error,
	};
}

export function useNetworkData() {
	const swr = useSWR<NetworkData>("/api/network", fetcher, {
		refreshInterval: REFRESH_INTERVAL_MS,
	});
	return { data: swr.data, isLoading: swr.isLoading, error: swr.error };
}

export interface DockerData {
	containers: { data: unknown[] };
	volumes: { data: unknown[] };
	images: { data: unknown[] };
}

export function useDockerData() {
	const swr = useSWR<DockerData>("/api/docker", fetcher, {
		refreshInterval: REFRESH_INTERVAL_MS,
	});
	return { data: swr.data, isLoading: swr.isLoading, error: swr.error };
}

export function useDashboardData() {
	const system = useSystemData();
	const services = useServicesData();
	const processes = useProcessesData();
	const network = useNetworkData();
	const docker = useDockerData();

	return {
		system: system.data,
		services: isRecord(services.data) && Array.isArray(services.data.services)
			? services.data.services
			: undefined,
		processes: isRecord(processes.data) && Array.isArray(processes.data.processes)
			? processes.data.processes
			: undefined,
		network: network.data,
		docker: docker.data,
		connected: false,
		isLoading: system.isLoading || services.isLoading,
		error:
			system.error ||
			services.error ||
			processes.error ||
			network.error ||
			docker.error,
	};
}
