/**
 * V11 — validation helper tests.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
	parseInput,
	notifyTestInputSchema,
	auditViewerQuerySchema,
	approvalSignalInputSchema,
} from "..";

describe("parseInput", () => {
	let errSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		errSpy.mockRestore();
	});

	it("returns ok=true on valid input", () => {
		const r = parseInput(
			notifyTestInputSchema,
			{ title: "hi" },
			{ action: "test" },
		);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.data.title).toBe("hi");
		expect(errSpy).not.toHaveBeenCalled();
	});

	it("returns structured error on invalid input and logs", () => {
		const r = parseInput(
			notifyTestInputSchema,
			{ source: "bad source!" },
			{ action: "notify-test" },
		);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.code).toBe("EVALIDATION");
			expect(r.issues.length).toBeGreaterThan(0);
			expect(r.issues[0].path).toBe("source");
		}
		expect(errSpy).toHaveBeenCalledTimes(1);
		const logged = JSON.parse(errSpy.mock.calls[0][0] as string);
		expect(logged.event).toBe("boundary_validation_error");
		expect(logged.action).toBe("notify-test");
	});

	it("rejects unknown fields on strict schemas", () => {
		const r = parseInput(
			approvalSignalInputSchema,
			{ runId: "run-1", signalName: "approval", decision: "approve", extra: true },
			{ action: "approvals.decide" },
		);
		expect(r.ok).toBe(false);
	});

	it("auditViewerQuerySchema coerces page numbers safely", () => {
		const r1 = auditViewerQuerySchema.parse({ page: "5" });
		expect(r1.page).toBe(5);
		const r2 = auditViewerQuerySchema.parse({});
		expect(r2.page).toBe(1);
		const r3 = auditViewerQuerySchema.parse({ page: "-7" });
		expect(r3.page).toBe(1);
		const r4 = auditViewerQuerySchema.parse({ page: "not-a-number" });
		expect(r4.page).toBe(1);
	});
});
