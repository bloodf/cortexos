// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @ai-sdk/openai-compatible so we can count provider creations.
const createSpy = vi.fn((_opts: unknown) => {
	const fn = ((modelId: string) => ({ modelId, _kind: "fake" })) as unknown as {
		(id: string): unknown;
	};
	return fn;
});

vi.mock("@ai-sdk/openai-compatible", () => ({
	createOpenAICompatible: (opts: unknown) => createSpy(opts),
}));

import {
	getNineRouterModel,
	discoverModels,
	AIProviderConfigError,
	_resetProviderCache,
} from "../provider-resolver";

const realFetch = global.fetch;

beforeEach(() => {
	createSpy.mockClear();
	_resetProviderCache();
	delete process.env.NINEROUTER_BASE_URL;
	delete process.env.NINEROUTER_API_KEY;
	delete process.env.NINEROUTER_DEFAULT_MODEL;
});

afterEach(() => {
	global.fetch = realFetch;
	vi.useRealTimers();
});

describe("getNineRouterModel", () => {
	it("throws AIProviderConfigError when base url is missing", () => {
		expect(() => getNineRouterModel()).toThrow(AIProviderConfigError);
	});

	it("throws AIProviderConfigError when api key is missing", () => {
		process.env.NINEROUTER_BASE_URL = "http://nr.local";
		expect(() => getNineRouterModel()).toThrow(AIProviderConfigError);
	});

	it("uses NINEROUTER_DEFAULT_MODEL when no id provided", () => {
		process.env.NINEROUTER_BASE_URL = "http://nr.local";
		process.env.NINEROUTER_API_KEY = "k";
		process.env.NINEROUTER_DEFAULT_MODEL = "claude-sonnet";
		const m = getNineRouterModel() as unknown as { modelId: string };
		expect(m.modelId).toBe("claude-sonnet");
	});

	it("normalizes 9Router base URL to the OpenAI-compatible v1 endpoint", () => {
		process.env.NINEROUTER_BASE_URL = "http://nr.local";
		process.env.NINEROUTER_API_KEY = "k";
		getNineRouterModel("a");
		expect(createSpy).toHaveBeenCalledWith(
			expect.objectContaining({ baseURL: "http://nr.local/v1" }),
		);
	});

	it("does not duplicate v1 when already configured", () => {
		process.env.NINEROUTER_BASE_URL = "http://nr.local/v1/";
		process.env.NINEROUTER_API_KEY = "k";
		getNineRouterModel("a");
		expect(createSpy).toHaveBeenCalledWith(
			expect.objectContaining({ baseURL: "http://nr.local/v1" }),
		);
	});

	it("caches provider across calls with same env", () => {
		process.env.NINEROUTER_BASE_URL = "http://nr.local";
		process.env.NINEROUTER_API_KEY = "k";
		getNineRouterModel("a");
		getNineRouterModel("b");
		expect(createSpy).toHaveBeenCalledTimes(1);
	});

	it("creates a new provider when env changes", () => {
		process.env.NINEROUTER_BASE_URL = "http://nr.local";
		process.env.NINEROUTER_API_KEY = "k1";
		getNineRouterModel("a");
		process.env.NINEROUTER_API_KEY = "k2";
		getNineRouterModel("a");
		expect(createSpy).toHaveBeenCalledTimes(2);
	});
});

describe("discoverModels", () => {
	beforeEach(() => {
		process.env.NINEROUTER_BASE_URL = "http://nr.local";
		process.env.NINEROUTER_API_KEY = "k";
	});

	it("returns ids and caches within 60s", async () => {
		const mock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: [{ id: "gpt-5" }, { id: "claude" }] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		global.fetch = mock;
		const a = await discoverModels();
		const b = await discoverModels();
		expect(a).toEqual(["gpt-5", "claude"]);
		expect(b).toEqual(["gpt-5", "claude"]);
		expect(mock).toHaveBeenCalledTimes(1);
	});

	it("refetches after TTL expires", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
		const makeRes = () =>
			new Response(JSON.stringify({ data: [{ id: "x" }] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		const mock = vi.fn().mockImplementation(async () => makeRes());
		global.fetch = mock;
		await discoverModels();
		vi.setSystemTime(61_000);
		await discoverModels();
		expect(mock).toHaveBeenCalledTimes(2);
	});

	it("throws on non-200 response", async () => {
		global.fetch = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
		await expect(discoverModels()).rejects.toBeInstanceOf(AIProviderConfigError);
	});
});
