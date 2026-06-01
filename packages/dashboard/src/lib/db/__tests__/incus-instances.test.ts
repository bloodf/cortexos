import { describe, it, expect, vi, beforeEach } from "vitest";
import { query, queryOne, execute } from "../client";
import {
	getIncusInstance,
	listIncusInstances,
	createIncusInstance,
	updateIncusInstanceStatus,
	setLastValidation,
	deleteIncusInstance,
	SAFE_NAME_RE,
} from "../incus-instances";

vi.mock("../client", () => ({
	query: vi.fn(),
	queryOne: vi.fn(),
	execute: vi.fn(),
}));

describe("incus-instances", () => {
	beforeEach(() => vi.clearAllMocks());

	it("SAFE_NAME_RE accepts/rejects expected names", () => {
		expect(SAFE_NAME_RE.test("mementry")).toBe(true);
		expect(SAFE_NAME_RE.test("my-app_1")).toBe(true);
		expect(SAFE_NAME_RE.test("1bad")).toBe(false);
		expect(SAFE_NAME_RE.test("bad name")).toBe(false);
	});

	it("getIncusInstance queries by name", async () => {
		(queryOne as any).mockResolvedValue(null);
		await getIncusInstance("demo");
		expect(queryOne).toHaveBeenCalledWith(
			expect.stringContaining("WHERE name = $1"),
			["demo"],
		);
	});

	it("getIncusInstance rejects bad name", async () => {
		await expect(getIncusInstance("1bad")).rejects.toThrow(/Invalid instance name/);
	});

	it("listIncusInstances orders by created_at desc", async () => {
		(query as any).mockResolvedValue([]);
		await listIncusInstances();
		expect(query).toHaveBeenCalledWith(
			expect.stringContaining("ORDER BY created_at DESC"),
		);
	});

	it("createIncusInstance inserts with draft default + JSONB config", async () => {
		(queryOne as any).mockResolvedValue({ id: 1, name: "demo", status: "draft" });
		await createIncusInstance({ name: "demo", config: { a: 1 }, created_by: "alice" });
		expect(queryOne).toHaveBeenCalledWith(
			expect.stringContaining("INSERT INTO incus_instances"),
			["demo", null, "draft", JSON.stringify({ a: 1 }), "alice"],
		);
	});

	it("createIncusInstance rejects bad status", async () => {
		await expect(
			createIncusInstance({ name: "demo", config: {}, status: "weird" as any }),
		).rejects.toThrow(/Invalid status/);
	});

	it("updateIncusInstanceStatus sets status + optional request id", async () => {
		(queryOne as any).mockResolvedValue({ id: 1, name: "demo", status: "provisioning" });
		await updateIncusInstanceStatus("demo", "provisioning", { lastRequestId: "req-1" });
		expect(queryOne).toHaveBeenCalledWith(
			expect.stringContaining("UPDATE incus_instances SET"),
			["demo", "provisioning", "req-1"],
		);
	});

	it("setLastValidation writes JSONB", async () => {
		(execute as any).mockResolvedValue(undefined);
		await setLastValidation("demo", { healthy: true });
		expect(execute).toHaveBeenCalledWith(
			expect.stringContaining("SET last_validation = $2::jsonb"),
			["demo", JSON.stringify({ healthy: true })],
		);
	});

	it("deleteIncusInstance deletes by name", async () => {
		(execute as any).mockResolvedValue(undefined);
		await deleteIncusInstance("demo");
		expect(execute).toHaveBeenCalledWith(
			"DELETE FROM incus_instances WHERE name = $1",
			["demo"],
		);
	});
});
