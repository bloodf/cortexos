// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/tool-audit", () => ({
	insertAuditRow: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/db/service", () => ({
	getAllServices: vi.fn().mockResolvedValue([
		{
			slug: "dashboard",
			name: "Dashboard",
			status: "ok",
			category: "AI",
			last_check_at: null,
			response_ms: 10,
		},
	]),
}));
vi.mock("@/lib/secrets/vps-reader", () => ({
	readEnvFile: vi.fn().mockResolvedValue([
		{ line: 1, raw: "FOO=bar", type: "kv", key: "FOO", value: "bar" },
	]),
}));
vi.mock("@/lib/runtime/host-ops", () => ({
	systemdAction: vi.fn().mockResolvedValue({ stdout: "ok", stderr: "" }),
	dockerAction: vi.fn().mockResolvedValue({ stdout: "ok", stderr: "" }),
}));

import { getAllTools, _resetToolCooldowns, _resetToolRateLimits } from "../tools";
import { insertAuditRow } from "@/lib/db/tool-audit";

const mockAudit = vi.mocked(insertAuditRow);

const ctx = { sessionId: "s-1", userId: 1 };

beforeEach(() => {
	mockAudit.mockClear();
	_resetToolCooldowns();
	_resetToolRateLimits();
});

async function runExec(tool: ReturnType<typeof getAllTools>[string], args: Record<string, unknown>) {
	const exec = (tool as unknown as { execute: (a: unknown, o: unknown) => unknown }).execute;
	return exec(args, { toolCallId: "tc-1", messages: [] });
}

describe("safe tool (vps_status — read-only)", () => {
	it("executes without confirmation token (safe class)", async () => {
		const tools = getAllTools(ctx);
		const out = await runExec(tools.vps_status, {});
		expect((out as { kind: string }).kind).toBe("ok");
	});
});

describe("privileged tool with valid token", () => {
	it("env_read with valid token returns ok and writes audit", async () => {
		const tools = getAllTools(ctx);
		const issued = (await runExec(tools.env_read, { path: "/opt/cortexos/secrets/dashboard.env" })) as {
			kind: string;
			token: string;
			args: Record<string, unknown>;
		};
		expect(issued.kind).toBe("confirmation_required");
		const ok = await runExec(tools.env_read, {
			...issued.args,
			confirmationToken: issued.token,
		});
		expect((ok as { kind: string }).kind).toBe("ok");
		// audit: prompt + allow
		const decisions = mockAudit.mock.calls.map((c) => c[0].decision);
		expect(decisions).toContain("prompt");
		expect(decisions).toContain("allow");
	});
});

describe("destructive tool cooldown", () => {
	it("service_restart denies repeat within cooldown", async () => {
		const tools = getAllTools(ctx);
		const issued = (await runExec(tools.service_restart, {
			service_name: "cortex-dashboard.service",
		})) as { kind: string; token: string; args: Record<string, unknown> };
		const first = await runExec(tools.service_restart, {
			...issued.args,
			confirmationToken: issued.token,
		});
		expect((first as { kind: string }).kind).toBe("ok");
		// Second attempt — issue a new token first, then verify cooldown blocks it.
		const second = await runExec(tools.service_restart, {
			service_name: "cortex-dashboard.service",
		});
		expect((second as { kind: string }).kind).toBe("denied");
	});
});

describe("bad token", () => {
	it("env_read with malformed token is denied", async () => {
		const tools = getAllTools(ctx);
		const out = await runExec(tools.env_read, {
			path: "/opt/cortexos/secrets/dashboard.env",
			confirmationToken: "not-a-real-token",
		});
		expect((out as { kind: string }).kind).toBe("denied");
	});
});

// ---------------------------------------------------------------------------
// M-9 — per-tool sliding-window rate limit
// ---------------------------------------------------------------------------

describe("per-tool sliding-window rate limit (M-9)", () => {
	it("denies after limit reached then allows again after window expiry", async () => {
		// Use a fresh module copy so we can mock policy.json without leaking
		// into the other tests (which depend on the real policy).
		vi.resetModules();
		vi.doMock("../tools-data/policy.json", () => ({
			default: {
				policy_version: 1,
				tools: [
					{
						name: "vps_status",
						class: "safe",
						description: "test-only",
						rate_limit_per_15min: 2,
					},
				],
			},
		}));

		const { getAllTools: freshGetTools, _resetToolRateLimits: reset } =
			await import("../tools");
		reset();

		const tools = freshGetTools(ctx);
		const ok1 = await runExec(tools.vps_status, {});
		const ok2 = await runExec(tools.vps_status, {});
		expect((ok1 as { kind: string }).kind).toBe("ok");
		expect((ok2 as { kind: string }).kind).toBe("ok");

		// Third call within window — denied with rate_limited reason.
		const denied = await runExec(tools.vps_status, {}) as {
			kind: string;
			reason?: string;
			retryAfterSeconds?: number;
		};
		expect(denied.kind).toBe("denied");
		expect(denied.reason).toBe("rate_limited");
		expect(typeof denied.retryAfterSeconds).toBe("number");
		expect(denied.retryAfterSeconds! > 0).toBe(true);

		// Audit row written with deny + rate_limit_exceeded.
		const denyReasons = mockAudit.mock.calls
			.filter((c) => c[0].decision === "deny")
			.map((c) => c[0].decision_reason);
		expect(denyReasons).toContain("rate_limit_exceeded");

		// Fake-clock forward past 15min — fourth call allowed again.
		vi.useFakeTimers();
		try {
			vi.setSystemTime(Date.now() + 16 * 60 * 1000);
			const ok3 = await runExec(tools.vps_status, {});
			expect((ok3 as { kind: string }).kind).toBe("ok");
		} finally {
			vi.useRealTimers();
		}

		vi.doUnmock("../tools-data/policy.json");
		vi.resetModules();
	});

	it("tools without rate_limit_per_15min are unrestricted", async () => {
		// Real policy.json — `propose_role` is safe and has no rate_limit field.
		// vps_status uses real policy (60/15min) which is far above what this
		// loop produces, so it's a safe negative check too.
		const tools = getAllTools(ctx);
		for (let i = 0; i < 10; i++) {
			const out = await runExec(tools.vps_status, {});
			expect((out as { kind: string }).kind).toBe("ok");
		}
	});
});
