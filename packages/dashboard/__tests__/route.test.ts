// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

const { mockExec } = vi.hoisted(() => ({ mockExec: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }) }));

vi.mock("util", async () => {
	const actual = await vi.importActual<typeof import("util")>("util");
	return {
		...actual,
		promisify: vi.fn(() => mockExec),
	};
});

describe("incus route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns instance list", async () => {
		mockExec.mockResolvedValueOnce({
			stdout: JSON.stringify([
				{
					name: "mementry",
					status: "Running",
					status_code: 103,
					type: "container",
					architecture: "aarch64",
					created_at: "2026-05-28T12:00:00Z",
					state: {
						network: {
							eth0: {
								addresses: [{ family: "inet", address: "10.0.0.2", netmask: "24" }],
							},
						},
					},
					profiles: ["default"],
					snapshots: [],
				},
			]),
			stderr: "",
		});

		const res = await GET();
		const json = await res.json();
		expect(json.data).toHaveLength(1);
		expect(json.data[0].name).toBe("mementry");
		expect(json.data[0].ipv4).toBe("10.0.0.2");
	});

	it("handles empty incus output", async () => {
		mockExec.mockResolvedValueOnce({ stdout: "[]", stderr: "" });

		const res = await GET();
		const json = await res.json();
		expect(json.data).toEqual([]);
	});

	it("returns error when incus fails", async () => {
		mockExec.mockRejectedValueOnce(new Error("incus not found"));

		const res = await GET();
		const json = await res.json();
		expect(res.status).toBe(500);
		expect(json.error).toContain("incus not found");
	});
});
