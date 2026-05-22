import { renderHook } from "@testing-library/react";
import useSWR from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	useDashboardData,
	useDockerData,
	useNetworkData,
	useProcessesData,
	useServicesData,
	useSystemData,
} from "../use-dashboard-data";

vi.mock("swr", () => ({
	default: vi.fn(),
}));

const mockUseSWR = vi.mocked(useSWR);

function mockSWR(data: unknown) {
	return {
		data,
		error: undefined,
		isLoading: false,
		mutate: vi.fn(),
	} as never;
}

describe("dashboard data hooks", () => {
	beforeEach(() => {
		mockUseSWR.mockReset();
		mockUseSWR.mockImplementation((key: unknown) => {
			if (key === "/api/system") return mockSWR({ cpu: 10 });
			if (key === "/api/services") {
				return mockSWR({ services: [{ id: 1, name: "Service" }] });
			}
			if (key === "/api/processes") {
				return mockSWR({ processes: [{ pid: 1 }] });
			}
			if (key === "/api/network") return mockSWR({ interfaces: [] });
			if (key === "/api/docker") {
				return mockSWR({
					containers: { data: [] },
					volumes: { data: [] },
					images: { data: [] },
				});
			}
			return mockSWR(undefined);
		});
	});

	it("useSystemData only subscribes to system data", () => {
		const { result } = renderHook(() => useSystemData());

		expect(mockUseSWR).toHaveBeenCalledTimes(1);
		expect(mockUseSWR.mock.calls[0]?.[0]).toBe("/api/system");
		expect(result.current.data).toEqual({ cpu: 10 });
	});

	it("useServicesData only subscribes to services data", () => {
		const { result } = renderHook(() => useServicesData());

		expect(mockUseSWR).toHaveBeenCalledTimes(1);
		expect(mockUseSWR.mock.calls[0]?.[0]).toBe("/api/services");
		expect(result.current.data).toEqual({
			services: [{ id: 1, name: "Service" }],
		});
	});

	it("useProcessesData only subscribes to process data", () => {
		const { result } = renderHook(() => useProcessesData());

		expect(mockUseSWR).toHaveBeenCalledTimes(1);
		expect(mockUseSWR.mock.calls[0]?.[0]).toBe("/api/processes");
		expect(result.current.data).toEqual({ processes: [{ pid: 1 }] });
	});

	it("useNetworkData only subscribes to network data", () => {
		const { result } = renderHook(() => useNetworkData());

		expect(mockUseSWR).toHaveBeenCalledTimes(1);
		expect(mockUseSWR.mock.calls[0]?.[0]).toBe("/api/network");
		expect(result.current.data).toEqual({ interfaces: [] });
	});

	it("useDockerData only subscribes to docker data", () => {
		const { result } = renderHook(() => useDockerData());

		expect(mockUseSWR).toHaveBeenCalledTimes(1);
		expect(mockUseSWR.mock.calls[0]?.[0]).toBe("/api/docker");
		expect(result.current.data).toEqual({
			containers: { data: [] },
			volumes: { data: [] },
			images: { data: [] },
		});
	});

	it("useDashboardData remains available for pages that explicitly need every source", () => {
		const { result } = renderHook(() => useDashboardData());

		expect(mockUseSWR.mock.calls.map((call) => call[0])).toEqual([
			"/api/system",
			"/api/services",
			"/api/processes",
			"/api/network",
			"/api/docker",
		]);
		expect(result.current.connected).toBe(false);
		expect(result.current.services).toEqual([{ id: 1, name: "Service" }]);
		expect(result.current.processes).toEqual([{ pid: 1 }]);
	});
});
