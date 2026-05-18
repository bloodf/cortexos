import { useEffect, useState } from "react";
import useSWR from "swr";
import { useSocket } from "./use-socket";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export interface ServiceCheck {
	id: number;
	slug: string;
	name: string;
	url: string;
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

export interface SystemData {
	cpu: number;
	memory: { percent: number; used: number; total: number };
	drives: DriveInfo[];
	mounts: MountInfo[];
	load: number[];
	uptime?: number;
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

export function useDashboardData() {
	const { connected, subscribe, unsubscribe } = useSocket();
	const [socketData, setSocketData] = useState<Partial<DashboardData>>({});

	useEffect(() => {
		const onSystem = (payload: unknown) =>
			setSocketData((d) => ({ ...d, system: payload as SystemData }));
		const onServices = (payload: unknown) =>
			setSocketData((d) => ({
				...d,
				services: Array.isArray(payload)
					? payload
					: isRecord(payload) && Array.isArray(payload.services)
						? payload.services as ServiceCheck[]
						: d.services,
			}));
		const onProcesses = (payload: unknown) =>
			setSocketData((d) => ({
				...d,
				processes: Array.isArray(payload)
					? payload
					: isRecord(payload) && Array.isArray(payload.processes)
						? payload.processes as ProcessInfo[]
						: d.processes,
			}));
		const onNetwork = (payload: unknown) =>
			setSocketData((d) => ({ ...d, network: payload as NetworkData }));
		const onDocker = (payload: unknown) =>
			setSocketData((d) => ({ ...d, docker: payload }));

		subscribe("system:metrics", onSystem);
		subscribe("services:status", onServices);
		subscribe("processes:list", onProcesses);
		subscribe("network:stats", onNetwork);
		subscribe("docker:status", onDocker);

		return () => {
			unsubscribe("system:metrics", onSystem);
			unsubscribe("services:status", onServices);
			unsubscribe("processes:list", onProcesses);
			unsubscribe("network:stats", onNetwork);
			unsubscribe("docker:status", onDocker);
		};
	}, [subscribe, unsubscribe]);

	const systemSWR = useSWR("/api/system", fetcher, { refreshInterval: 3000 });
	const servicesSWR = useSWR("/api/services", fetcher, { refreshInterval: 3000 });
	const processesSWR = useSWR("/api/processes", fetcher, { refreshInterval: 3000 });
	const networkSWR = useSWR("/api/network", fetcher, { refreshInterval: 3000 });
	const dockerSWR = useSWR("/api/docker", fetcher, { refreshInterval: 3000 });

	const isLoading =
		(!socketData.system && systemSWR.isLoading) ||
		(!socketData.services && servicesSWR.isLoading);

	const services = Array.isArray(socketData.services)
		? socketData.services
		: Array.isArray(servicesSWR.data?.services)
			? servicesSWR.data.services
			: undefined;
	const processes = Array.isArray(socketData.processes)
		? socketData.processes
		: Array.isArray(processesSWR.data?.processes)
			? processesSWR.data.processes
			: undefined;

	return {
		system: socketData.system ?? systemSWR.data,
		services,
		processes,
		network: socketData.network ?? networkSWR.data,
		docker: socketData.docker ?? dockerSWR.data,
		connected,
		isLoading,
		error:
			systemSWR.error ||
			servicesSWR.error ||
			processesSWR.error ||
			networkSWR.error ||
			dockerSWR.error,
	};
}

import { useContext } from "react";
import { DashboardDataContext } from "./dashboard-data-context";

function useDashboard() {
	const ctx = useContext(DashboardDataContext);
	const direct = useDashboardData();
	return ctx ?? direct;
}

export function useSystemData() {
	const { system, isLoading, error } = useDashboard();
	return { data: system as SystemData | undefined, isLoading, error };
}

export function useServicesData() {
	const { services, isLoading, error } = useDashboard();
	const safeServices = Array.isArray(services) ? services : [];
	return { data: { services: safeServices }, isLoading, error };
}

export function useProcessesData() {
	const { processes, isLoading, error } = useDashboard();
	const safeProcesses = Array.isArray(processes) ? processes : [];
	return { data: { processes: safeProcesses }, isLoading, error };
}

export function useNetworkData() {
	const { network, isLoading, error } = useDashboard();
	return { data: network as NetworkData | undefined, isLoading, error };
}

export interface DockerData {
	containers: { data: unknown[] };
	volumes: { data: unknown[] };
	images: { data: unknown[] };
}

export function useDockerData() {
	const { docker, isLoading, error } = useDashboard();
	return { data: docker as DockerData | undefined, isLoading, error };
}
