import { describe, expect, it } from "vitest";
import { shouldAutoTrash, validateClassification } from "../src/model.js";

describe("model decisions", () => {
	it("auto-trashes only when classifier and verifier meet threshold", () => {
		const classification = validateClassification({
			verdict: "spam",
			confidence: 0.96,
			reasons: ["scam"],
			riskSignals: [],
		});
		const verification = validateClassification({
			verdict: "spam",
			confidence: 0.95,
			reasons: ["phishing"],
			riskSignals: [],
		});
		expect(shouldAutoTrash({ classification, verification, threshold: 0.95, hasAllowRule: false })).toBe(true);
		expect(shouldAutoTrash({ classification, verification, threshold: 0.97, hasAllowRule: false })).toBe(false);
		expect(shouldAutoTrash({ classification, verification, threshold: 0.95, hasAllowRule: true })).toBe(false);
	});

	it("rejects malformed classifier output", () => {
		expect(() => validateClassification({ verdict: "maybe", confidence: 1.1 })).toThrow();
	});
});
