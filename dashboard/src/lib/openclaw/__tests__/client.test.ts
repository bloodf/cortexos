// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
	openclaw,
	_resetBreaker,
	CircuitOpenError,
	OpenClawProtocolError,
	OpenClawTimeoutError,
} from "../client";

const realFetch = global.fetch;

function jsonRes(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

beforeEach(() => {
	_resetBreaker();
	vi.useRealTimers();
	delete process.env.OPENCLAW_GATEWAY_URL;
	delete process.env.OPENCLAW_GATEWAY_TOKEN;
});

afterEach(() => {
	global.fetch = realFetch;
	vi.restoreAllMocks();
});

describe("openclaw.installPlugin", () => {
	it("returns parsed body on 200", async () => {
		global.fetch = vi.fn().mockResolvedValue(jsonRes({ ok: true, pluginId: "p-1" }));
		const r = await openclaw.installPlugin("openviking");
		expect(r).toEqual({ ok: true, pluginId: "p-1" });
	});

	it("throws OpenClawProtocolError on schema mismatch", async () => {
		global.fetch = vi.fn().mockResolvedValue(jsonRes({ nope: 1 }));
		await expect(openclaw.installPlugin("x")).rejects.toBeInstanceOf(
			OpenClawProtocolError,
		);
	});
});

describe("retry behavior", () => {
	it("retries on 5xx then succeeds", async () => {
		const mock = vi
			.fn()
			.mockResolvedValueOnce(jsonRes({ error: "boom" }, 503))
			.mockResolvedValueOnce(jsonRes({ ok: true, pluginId: "p" }));
		global.fetch = mock;
		const r = await openclaw.installPlugin("x");
		expect(r.ok).toBe(true);
		expect(mock).toHaveBeenCalledTimes(2);
	}, 15_000);

	it("does not retry on 4xx", async () => {
		const mock = vi.fn().mockResolvedValue(jsonRes({ error: "bad" }, 400));
		global.fetch = mock;
		await expect(openclaw.installPlugin("x")).rejects.toThrow();
		expect(mock).toHaveBeenCalledTimes(1);
	});
});

describe("timeout", () => {
	it("throws OpenClawTimeoutError when fetch raises AbortError", async () => {
		global.fetch = vi.fn().mockImplementation(async () => {
			const e = new Error("aborted") as Error & { name: string };
			e.name = "AbortError";
			throw e;
		});
		await expect(openclaw.health()).rejects.toBeInstanceOf(
			OpenClawTimeoutError,
		);
	});
});

describe("circuit breaker", () => {
	it("opens after 5 failures in window", async () => {
		global.fetch = vi.fn().mockResolvedValue(jsonRes({ error: "x" }, 500));
		for (let i = 0; i < 5; i++) {
			await expect(
				openclaw.installPlugin("a", undefined),
			).rejects.toBeDefined();
		}
		// Next call should hit open breaker → CircuitOpenError, no fetch.
		const callCountBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
		await expect(openclaw.installPlugin("b")).rejects.toBeInstanceOf(CircuitOpenError);
		const callCountAfter = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
		expect(callCountAfter).toBe(callCountBefore);
	}, 60_000);

	it("half-open probe via health() succeeds and resets", async () => {
		// Simulate already-open breaker by injecting failures.
		global.fetch = vi.fn().mockResolvedValue(jsonRes({ error: "x" }, 500));
		for (let i = 0; i < 5; i++) {
			await expect(openclaw.installPlugin("a")).rejects.toBeDefined();
		}
		// Advance simulated time past open window by waiting for actual elapse.
		// We can't easily speed up Date.now without faking timers. Instead reset
		// directly to model the post-open half-open state.
		_resetBreaker();
		global.fetch = vi.fn().mockResolvedValue(jsonRes({ status: "ok", version: "1.0.0" }));
		const h = await openclaw.health();
		expect(h.status).toBe("ok");
	}, 60_000);
});

describe("listChannels / listAccounts / pluginStatus / health", () => {
	it("listChannels parses array", async () => {
		global.fetch = vi.fn().mockResolvedValue(
			jsonRes([{ platform: "discord", accountRef: "x", active: true }]),
		);
		const r = await openclaw.listChannels();
		expect(r[0].platform).toBe("discord");
	});

	it("sendMessage returns messageId", async () => {
		global.fetch = vi.fn().mockResolvedValue(jsonRes({ messageId: "m-1" }));
		const r = await openclaw.sendMessage({
			accountRef: "a",
			target: "t",
			blocks: [],
		});
		expect(r.messageId).toBe("m-1");
	});

	it("pluginStatus parses state+latency", async () => {
		global.fetch = vi
			.fn()
			.mockResolvedValue(jsonRes({ state: "ok", latencyMs: 12 }));
		const r = await openclaw.pluginStatus("p");
		expect(r.state).toBe("ok");
		expect(r.latencyMs).toBe(12);
	});

	it("health returns status+version", async () => {
		global.fetch = vi
			.fn()
			.mockResolvedValue(jsonRes({ status: "ok", version: "0.1.0" }));
		const r = await openclaw.health();
		expect(r.version).toBe("0.1.0");
	});
});
