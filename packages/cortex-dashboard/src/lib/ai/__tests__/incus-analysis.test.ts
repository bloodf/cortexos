import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("../provider-resolver", () => ({ getNineRouterModel: vi.fn(() => ({})) }));
vi.mock("@/lib/db/config-kv", () => ({ getConfigValue: vi.fn(async () => "") }));

import { generateObject } from "ai";
import { analyzeTarget, aiPreflightAdvice, aiPostcreateAdvice } from "../incus-analysis";

const ORIG = { ...process.env };

describe("incus-analysis (AI assist)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NINEROUTER_BASE_URL = "http://x";
		process.env.NINEROUTER_API_KEY = "k";
	});

	it("returns null when provider env is unset", async () => {
		delete process.env.NINEROUTER_BASE_URL;
		delete process.env.NINEROUTER_API_KEY;
		expect(await analyzeTarget({ mode: "new", description: "x" })).toBeNull();
		expect(generateObject).not.toHaveBeenCalled();
		process.env = { ...ORIG };
	});

	it("returns the generated object on success", async () => {
		(generateObject as any).mockResolvedValue({
			object: {
				detectedLanguage: "TypeScript",
				detectedRuntime: "node",
				needsGastown: false,
				gastownReason: "",
				resourceHints: { cpu: "4", memoryGiB: 4 },
				suggestedHermesPort: 18700,
				warnings: [],
				confidence: 0.8,
			},
		});
		const r = await analyzeTarget({ mode: "existing", repoUrl: "https://github.com/bloodf/demo.git" });
		expect(r?.detectedLanguage).toBe("TypeScript");
	});

	it("returns null on generateObject failure (never throws)", async () => {
		(generateObject as any).mockRejectedValue(new Error("model down"));
		expect(await analyzeTarget({ mode: "new", description: "x" })).toBeNull();
	});

	it("aiPreflightAdvice returns null on failure", async () => {
		(generateObject as any).mockRejectedValue(new Error("x"));
		const r = await aiPreflightAdvice({} as any, { ok: true, checks: [] });
		expect(r).toBeNull();
	});

	it("aiPostcreateAdvice returns object on success", async () => {
		(generateObject as any).mockResolvedValue({
			object: { healthy: true, checks: [], remediation: [] },
		});
		const r = await aiPostcreateAdvice({ hermes: 200 });
		expect(r?.healthy).toBe(true);
	});
});
