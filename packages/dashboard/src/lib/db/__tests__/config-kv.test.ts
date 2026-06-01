import { describe, it, expect, vi, beforeEach } from "vitest";
import { queryOne, execute } from "../client";
import { getConfigValue, setConfigValue } from "../config-kv";

vi.mock("../client", () => ({
	queryOne: vi.fn(),
	execute: vi.fn(),
}));

describe("config-kv", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns fallback when key missing", async () => {
		(queryOne as any).mockResolvedValue(null);
		expect(await getConfigValue("x", "def")).toBe("def");
		expect(await getConfigValue("x", { a: 1 })).toEqual({ a: 1 });
	});

	it("returns raw text for string fallback", async () => {
		(queryOne as any).mockResolvedValue({ value: "cx/gpt-5.5" });
		expect(await getConfigValue("incus.ai.model", "")).toBe("cx/gpt-5.5");
	});

	it("JSON-parses for object fallback", async () => {
		(queryOne as any).mockResolvedValue({ value: '{"image":"x"}' });
		expect(await getConfigValue("incus.wizard.defaults", {})).toEqual({ image: "x" });
	});

	it("returns fallback on parse failure", async () => {
		(queryOne as any).mockResolvedValue({ value: "not-json{" });
		expect(await getConfigValue("k", { ok: true })).toEqual({ ok: true });
	});

	it("setConfigValue stores strings verbatim and upserts", async () => {
		(execute as any).mockResolvedValue(undefined);
		await setConfigValue("incus.ai.model", "cx/gpt-5.5");
		expect(execute).toHaveBeenCalledWith(
			expect.stringContaining("ON CONFLICT (key) DO UPDATE"),
			["incus.ai.model", "cx/gpt-5.5"],
		);
	});

	it("setConfigValue JSON-encodes non-strings", async () => {
		(execute as any).mockResolvedValue(undefined);
		await setConfigValue("incus.wizard.defaults", { image: "x" });
		expect(execute).toHaveBeenCalledWith(
			expect.any(String),
			["incus.wizard.defaults", JSON.stringify({ image: "x" })],
		);
	});
});
