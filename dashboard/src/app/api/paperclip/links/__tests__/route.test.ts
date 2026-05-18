import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => ({
	query: vi.fn(),
}));

import { GET } from "../route";
import { query } from "@/lib/db/client";

const mockQuery = vi.mocked(query);

describe("GET /api/paperclip/links", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns rows ordered by updated_at desc", async () => {
		const rows = [
			{
				id: 1,
				paperclip_issue_id: "ISSUE-1",
				paperclip_run_id: "run-1",
				paperclip_agent_id: "agent-1",
				cortex_role: "ENG-BACKEND",
				nats_subject: "cortex.task.eng-backend",
				status: "in_progress",
				cost_usd_cents: 250,
				created_at: "2026-05-18T10:00:00.000Z",
				updated_at: "2026-05-18T11:00:00.000Z",
			},
		];
		mockQuery.mockResolvedValue(rows);

		const res = await GET();
		const body = await res.json();
		expect(body.rows).toEqual(rows);
		expect(typeof body.timestamp).toBe("number");
	});

	it("returns empty rows + warning when table missing", async () => {
		const err = Object.assign(new Error("relation does not exist"), { code: "42P01" });
		mockQuery.mockRejectedValue(err);

		const res = await GET();
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.rows).toEqual([]);
		expect(body.warning).toMatch(/not present/);
	});

	it("returns 500 on generic db error", async () => {
		mockQuery.mockRejectedValue(new Error("boom"));

		const res = await GET();
		const body = await res.json();
		expect(res.status).toBe(500);
		expect(body.error).toBe("boom");
	});
});
