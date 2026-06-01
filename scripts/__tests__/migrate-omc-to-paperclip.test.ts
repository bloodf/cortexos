import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	applyTasks,
	computeOmcTaskId,
	groupEvents,
	parseArgs,
	readJsonlEvents,
	readSessionStateEvents,
	summarize,
	type RawEvent,
	type SyntheticTask,
} from "../migrate-omc-to-paperclip";

function ev(
	sessionId: string,
	role: string,
	timestamp: string,
	source = "test",
): RawEvent {
	return { sessionId, role, timestamp, source };
}

describe("parseArgs", () => {
	it("defaults to dry-run", () => {
		const a = parseArgs([]);
		expect(a.dryRun).toBe(true);
		expect(a.apply).toBe(false);
	});

	it("flips to apply mode and reads date filters", () => {
		const a = parseArgs([
			"--apply",
			"--from-date",
			"2026-01-01",
			"--to-date",
			"2026-03-01",
			"--staging",
		]);
		expect(a.apply).toBe(true);
		expect(a.dryRun).toBe(false);
		expect(a.fromDate).toBe("2026-01-01");
		expect(a.toDate).toBe("2026-03-01");
		expect(a.staging).toBe(true);
	});
});

describe("computeOmcTaskId", () => {
	it("is deterministic and 16 hex chars", () => {
		const a = computeOmcTaskId("s1", "ENG", "2026-01-01T00:00:00Z");
		const b = computeOmcTaskId("s1", "ENG", "2026-01-01T00:00:00Z");
		expect(a).toBe(b);
		expect(a).toMatch(/^[0-9a-f]{16}$/);
	});

	it("changes when any input changes", () => {
		const a = computeOmcTaskId("s1", "ENG", "2026-01-01T00:00:00Z");
		const b = computeOmcTaskId("s1", "ENG", "2026-01-01T00:00:01Z");
		const c = computeOmcTaskId("s2", "ENG", "2026-01-01T00:00:00Z");
		expect(a).not.toBe(b);
		expect(a).not.toBe(c);
	});
});

describe("groupEvents", () => {
	it("groups by (sessionId, role) with earliest+latest timestamps", () => {
		const tasks = groupEvents([
			ev("s1", "ENG", "2026-01-02T00:00:00Z"),
			ev("s1", "ENG", "2026-01-01T00:00:00Z"),
			ev("s1", "ENG", "2026-01-03T00:00:00Z"),
			ev("s1", "QA", "2026-01-01T00:00:00Z"),
			ev("s2", "ENG", "2026-01-01T00:00:00Z"),
		]);
		expect(tasks).toHaveLength(3);
		const eng1 = tasks.find((t) => t.sessionId === "s1" && t.role === "ENG");
		expect(eng1?.eventCount).toBe(3);
		expect(eng1?.start).toBe("2026-01-01T00:00:00Z");
		expect(eng1?.end).toBe("2026-01-03T00:00:00Z");
	});

	it("derives omcTaskId from earliest timestamp (stable across event order)", () => {
		const a = groupEvents([
			ev("s1", "ENG", "2026-01-02T00:00:00Z"),
			ev("s1", "ENG", "2026-01-01T00:00:00Z"),
		]);
		const b = groupEvents([
			ev("s1", "ENG", "2026-01-01T00:00:00Z"),
			ev("s1", "ENG", "2026-01-02T00:00:00Z"),
		]);
		expect(a[0].omcTaskId).toBe(b[0].omcTaskId);
	});
});

describe("summarize", () => {
	it("aggregates by role descending by task count", () => {
		const events = [
			ev("s1", "ENG", "2026-01-01T00:00:00Z"),
			ev("s2", "ENG", "2026-01-01T00:00:00Z"),
			ev("s3", "QA", "2026-01-01T00:00:00Z"),
		];
		const tasks = groupEvents(events);
		const sum = summarize(events, tasks);
		expect(sum.totalEvents).toBe(3);
		expect(sum.totalTasks).toBe(3);
		expect(sum.byRole[0].role).toBe("ENG");
		expect(sum.byRole[0].tasks).toBe(2);
	});
});

describe("readJsonlEvents", () => {
	it("reads .jsonl files, filters by date, tolerates malformed lines", async () => {
		const root = await mkdtemp(join(tmpdir(), "omc-jsonl-"));
		const logs = join(root, "logs");
		await mkdir(logs, { recursive: true });
		const good = [
			JSON.stringify({
				sessionId: "s1",
				role: "ENG",
				timestamp: "2026-01-15T12:00:00Z",
			}),
			"{not json",
			"",
			JSON.stringify({
				session: "s2",
				agent: "QA",
				ts: "2026-02-15T12:00:00Z",
			}),
			JSON.stringify({
				sessionId: "s1",
				role: "ENG",
				timestamp: "2025-12-31T12:00:00Z",
			}),
		].join("\n");
		await writeFile(join(logs, "omx-2026.jsonl"), good, "utf8");

		try {
			const events = await readJsonlEvents(root, {
				from: "2026-01-01",
				to: "2026-12-31",
			});
			expect(events).toHaveLength(2);
			const roles = events.map((e) => e.role).sort();
			expect(roles).toEqual(["ENG", "QA"]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it("returns [] when logs dir missing", async () => {
		const root = await mkdtemp(join(tmpdir(), "omc-missing-"));
		try {
			const events = await readJsonlEvents(root, {});
			expect(events).toEqual([]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});

describe("readSessionStateEvents", () => {
	it("reads JSON state files (single objects or arrays)", async () => {
		const root = await mkdtemp(join(tmpdir(), "omc-state-"));
		const dirA = join(root, "state", "sessions", "s1");
		const dirB = join(root, "state", "sessions", "s2");
		await mkdir(dirA, { recursive: true });
		await mkdir(dirB, { recursive: true });
		await writeFile(
			join(dirA, "prompt-routing-state.json"),
			JSON.stringify({
				sessionId: "s1",
				role: "ENG",
				timestamp: "2026-03-01T00:00:00Z",
			}),
			"utf8",
		);
		await writeFile(
			join(dirB, "prompt-routing-state.json"),
			JSON.stringify([
				{
					sessionId: "s2",
					role: "QA",
					timestamp: "2026-03-02T00:00:00Z",
				},
				{ no_session: true },
			]),
			"utf8",
		);
		try {
			const events = await readSessionStateEvents(root, {});
			expect(events).toHaveLength(2);
			expect(events.map((e) => e.role).sort()).toEqual(["ENG", "QA"]);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});

describe("applyTasks (idempotency + counters)", () => {
	const tasks: SyntheticTask[] = [
		{
			omcTaskId: "aaaa000000000001",
			sessionId: "s1",
			role: "ENG",
			start: "2026-01-01T00:00:00Z",
			end: "2026-01-02T00:00:00Z",
			eventCount: 2,
		},
		{
			omcTaskId: "aaaa000000000002",
			sessionId: "s2",
			role: "QA",
			start: "2026-01-01T00:00:00Z",
			end: "2026-01-01T00:00:00Z",
			eventCount: 1,
		},
	];

	it("counts 409 as skippedConflict but still inserts link row", async () => {
		const result = await applyTasks(tasks, {
			postIssue: async (t) => ({
				status: t.role === "ENG" ? 201 : 409,
				issueId: `issue-${t.omcTaskId}`,
				runId: t.omcTaskId,
				agentId: t.role,
			}),
			insertLink: async () => ({ inserted: true }),
			log: () => undefined,
		});
		expect(result.created).toBe(1);
		expect(result.skippedConflict).toBe(1);
		expect(result.linkInserted).toBe(2);
		expect(result.failed).toBe(0);
	});

	it("re-runs are idempotent: link insert ON CONFLICT DO NOTHING", async () => {
		const seen = new Set<string>();
		const insertLink = async ({ task }: { task: SyntheticTask }) => {
			if (seen.has(task.omcTaskId)) return { inserted: false };
			seen.add(task.omcTaskId);
			return { inserted: true };
		};
		const first = await applyTasks(tasks, {
			postIssue: async (t) => ({
				status: 201,
				issueId: `i-${t.omcTaskId}`,
				runId: t.omcTaskId,
				agentId: t.role,
			}),
			insertLink,
			log: () => undefined,
		});
		const second = await applyTasks(tasks, {
			postIssue: async (t) => ({
				status: 409,
				issueId: `i-${t.omcTaskId}`,
				runId: t.omcTaskId,
				agentId: t.role,
			}),
			insertLink,
			log: () => undefined,
		});
		expect(first.linkInserted).toBe(2);
		expect(second.linkInserted).toBe(0);
		expect(second.linkSkipped).toBe(2);
	});

	it("counts post failures", async () => {
		const result = await applyTasks(tasks, {
			postIssue: async () => ({ status: 500 }),
			insertLink: async () => ({ inserted: true }),
			log: () => undefined,
		});
		expect(result.failed).toBe(2);
		expect(result.linkInserted).toBe(0);
	});
});
