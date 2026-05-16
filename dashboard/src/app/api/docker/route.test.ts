// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const { mockExec } = vi.hoisted(() => ({ mockExec: vi.fn().mockResolvedValue({ stdout: "", stderr: "" }) }));

vi.mock("util", async () => {
	const actual = await vi.importActual<typeof import("util")>("util");
	return {
		...actual,
		promisify: vi.fn(() => mockExec),
	};
});

function createRequest() {
	return new Request("http://localhost/api/docker");
}

describe("docker route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns containers, volumes, images", async () => {
		mockExec.mockResolvedValueOnce({ stdout: '{"ID":"c1"}\n', stderr: "" });
		mockExec.mockResolvedValueOnce({ stdout: '{"Name":"v1"}\n', stderr: "" });
		mockExec.mockResolvedValueOnce({ stdout: '{"ID":"i1"}\n', stderr: "" });

		const res = await GET();
		const json = await res.json();
		expect(json.containers.data).toHaveLength(1);
		expect(json.volumes.data).toHaveLength(1);
		expect(json.images.data).toHaveLength(1);
		expect(json.containers.data[0]).toEqual({ ID: "c1" });
	});

	it("handles empty docker output gracefully", async () => {
		mockExec.mockResolvedValue({ stdout: "", stderr: "" });

		const res = await GET();
		const json = await res.json();
		expect(json.containers.data).toEqual([]);
		expect(json.volumes.data).toEqual([]);
		expect(json.images.data).toEqual([]);
	});

	it("returns error field when docker fails", async () => {
		mockExec.mockRejectedValueOnce(new Error("docker not found"));
		mockExec.mockResolvedValueOnce({ stdout: "", stderr: "" });
		mockExec.mockResolvedValueOnce({ stdout: "", stderr: "" });

		const res = await GET();
		const json = await res.json();
		expect(json.containers.error).toContain("docker not found");
		expect(json.volumes.data).toEqual([]);
	});

	it("falls back to raw line on bad json", async () => {
		mockExec.mockResolvedValueOnce({ stdout: "not-json\n", stderr: "" });
		mockExec.mockResolvedValueOnce({ stdout: "", stderr: "" });
		mockExec.mockResolvedValueOnce({ stdout: "", stderr: "" });

		const res = await GET();
		const json = await res.json();
		expect(json.containers.data[0]).toEqual({ raw: "not-json" });
	});
});
