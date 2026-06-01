import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useDashboardData, useSystemData, useServicesData } from "../use-dashboard-data";

function createMockSocket(connected = false) {
	const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
	return {
		connected,
		on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
			if (!listeners.has(event)) listeners.set(event, []);
			listeners.get(event)!.push(cb);
		}),
		off: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
			const arr = listeners.get(event) ?? [];
			const idx = arr.indexOf(cb);
			if (idx > -1) arr.splice(idx, 1);
		}),
		emit: (event: string, ...args: unknown[]) => {
			(listeners.get(event) ?? []).forEach((cb) => cb(...args));
		},
		disconnect: vi.fn(),
	};
}

let mockSocket = createMockSocket();

vi.mock("../use-socket", () => ({
	useSocket: () => ({
		socket: mockSocket,
		connected: mockSocket.connected,
		subscribe: mockSocket.on,
		unsubscribe: mockSocket.off,
	}),
}));

vi.mock("swr", () => {
	return {
		default: (key: string | null) => {
			if (!key) return { data: undefined, error: undefined, isLoading: false };
			return {
				data: key === "/api/services" ? { services: [{ id: 1, name: "SWR Service" }] } : { fallback: true },
				error: undefined,
				isLoading: false,
			};
		},
	};
});

describe("useDashboardData", () => {
	beforeEach(() => {
		mockSocket = createMockSocket();
		vi.clearAllMocks();
	});

	it("subscribes to all socket events on mount", () => {
		renderHook(() => useDashboardData());
		expect(mockSocket.on).toHaveBeenCalledWith("system:metrics", expect.any(Function));
		expect(mockSocket.on).toHaveBeenCalledWith("services:status", expect.any(Function));
		expect(mockSocket.on).toHaveBeenCalledWith("processes:list", expect.any(Function));
		expect(mockSocket.on).toHaveBeenCalledWith("network:stats", expect.any(Function));
		expect(mockSocket.on).toHaveBeenCalledWith("docker:status", expect.any(Function));
	});

	it("unsubscribes from all socket events on unmount", () => {
		const { unmount } = renderHook(() => useDashboardData());
		unmount();
		expect(mockSocket.off).toHaveBeenCalledWith("system:metrics", expect.any(Function));
		expect(mockSocket.off).toHaveBeenCalledWith("services:status", expect.any(Function));
		expect(mockSocket.off).toHaveBeenCalledWith("processes:list", expect.any(Function));
		expect(mockSocket.off).toHaveBeenCalledWith("network:stats", expect.any(Function));
		expect(mockSocket.off).toHaveBeenCalledWith("docker:status", expect.any(Function));
	});

	it("updates services data from socket event", () => {
		const { result } = renderHook(() => useDashboardData());
		act(() => {
			mockSocket.emit("services:status", {
				services: [{ id: 1, name: "Socket Service", status: "online", responseTime: 42 }],
			});
		});
		expect(result.current.services).toEqual([
			{ id: 1, name: "Socket Service", status: "online", responseTime: 42 },
		]);
	});

	it("updates system data from socket event", () => {
		const { result } = renderHook(() => useDashboardData());
		act(() => {
			mockSocket.emit("system:metrics", { cpu: 50 });
		});
		expect(result.current.system).toEqual({ cpu: 50 });
	});

	it("updates processes data from socket event", () => {
		const { result } = renderHook(() => useDashboardData());
		act(() => {
			mockSocket.emit("processes:list", { processes: [{ pid: 1 }] });
		});
		expect(result.current.processes).toEqual([{ pid: 1 }]);
	});

	it("updates network data from socket event", () => {
		const { result } = renderHook(() => useDashboardData());
		act(() => {
			mockSocket.emit("network:stats", { rx: 100 });
		});
		expect(result.current.network).toEqual({ rx: 100 });
	});

	it("updates docker data from socket event", () => {
		const { result } = renderHook(() => useDashboardData());
		act(() => {
			mockSocket.emit("docker:status", { containers: [{ name: "app" }] });
		});
		expect(result.current.docker).toEqual({ containers: [{ name: "app" }] });
	});

	it("returns connected state", () => {
		mockSocket = createMockSocket(true);
		const { result } = renderHook(() => useDashboardData());
		expect(result.current.connected).toBe(true);
	});

	it("falls back to SWR when disconnected", () => {
		mockSocket = createMockSocket(false);
		const { result } = renderHook(() => useDashboardData());
		expect(result.current.connected).toBe(false);
		expect(result.current.services).toEqual([{ id: 1, name: "SWR Service" }]);
	});

	it("prefers socket data over SWR when connected", () => {
		mockSocket = createMockSocket(true);
		const { result } = renderHook(() => useDashboardData());
		act(() => {
			mockSocket.emit("services:status", {
				services: [{ id: 2, name: "Live Service" }],
			});
		});
		expect(result.current.services).toEqual([{ id: 2, name: "Live Service" }]);
	});

	it("falls back to SWR when connected but socket data empty", () => {
		mockSocket = createMockSocket(true);
		const { result } = renderHook(() => useDashboardData());
		expect(result.current.connected).toBe(true);
		expect(result.current.services).toEqual([{ id: 1, name: "SWR Service" }]);
	});

	it("exposes isLoading when no data available", () => {
		mockSocket = createMockSocket(false);
		const { result } = renderHook(() => useDashboardData());
		expect(result.current.isLoading).toBe(false);
	});
});

describe("backward-compatible hooks", () => {
	beforeEach(() => {
		mockSocket = createMockSocket(true);
	});

	it("useSystemData returns system data", () => {
		const { result } = renderHook(() => useSystemData());
		act(() => {
			mockSocket.emit("system:metrics", { cpu: 10 });
		});
		expect(result.current.data).toEqual({ cpu: 10 });
	});

	it("useServicesData returns services data", () => {
		const { result } = renderHook(() => useServicesData());
		act(() => {
			mockSocket.emit("services:status", { services: [{ id: 1 }] });
		});
		expect(result.current.data).toEqual({ services: [{ id: 1 }] });
	});
});
