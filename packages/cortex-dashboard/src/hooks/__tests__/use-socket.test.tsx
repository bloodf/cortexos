import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useSocket } from "../use-socket";

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

vi.mock("@/lib/socket", () => ({
	getSocket: () => mockSocket,
}));

describe("useSocket", () => {
	beforeEach(() => {
		mockSocket = createMockSocket();
		vi.clearAllMocks();
	});

	it("returns socket and connected false initially", () => {
		const { result } = renderHook(() => useSocket());
		expect(result.current.socket).toBe(mockSocket);
		expect(result.current.connected).toBe(false);
	});

	it("sets connected true when already connected", () => {
		mockSocket = createMockSocket(true);
		const { result } = renderHook(() => useSocket());
		expect(result.current.connected).toBe(true);
	});

	it("updates connected on connect event", () => {
		const { result } = renderHook(() => useSocket());
		act(() => {
			mockSocket.emit("connect");
		});
		expect(result.current.connected).toBe(true);
	});

	it("updates connected on disconnect event", () => {
		mockSocket = createMockSocket(true);
		const { result } = renderHook(() => useSocket());
		expect(result.current.connected).toBe(true);
		act(() => {
			mockSocket.emit("disconnect");
		});
		expect(result.current.connected).toBe(false);
	});

	it("subscribes to event", () => {
		const { result } = renderHook(() => useSocket());
		const cb = vi.fn();
		result.current.subscribe("test-event", cb);
		expect(mockSocket.on).toHaveBeenCalledWith("test-event", cb);
	});

	it("unsubscribes from event", () => {
		const { result } = renderHook(() => useSocket());
		const cb = vi.fn();
		result.current.unsubscribe("test-event", cb);
		expect(mockSocket.off).toHaveBeenCalledWith("test-event", cb);
	});

	it("cleans up connect/disconnect listeners on unmount", () => {
		const { unmount } = renderHook(() => useSocket());
		unmount();
		expect(mockSocket.off).toHaveBeenCalledWith(
			"connect",
			expect.any(Function),
		);
		expect(mockSocket.off).toHaveBeenCalledWith(
			"disconnect",
			expect.any(Function),
		);
	});
});
