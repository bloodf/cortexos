/**
 * Vercel AI SDK tool registry for the Cortex chat panel.
 *
 * Each tool definition consults the policy (loaded from `tools-data/policy.json`,
 * mirrored from `templates/agentgateway/tools.json`) for its class and rate-limit.
 * Privileged/destructive tools follow the confirmation-token issue/verify dance
 * before executing. Every invocation writes a row to `agent_gateway_audit`.
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import { tool, type Tool } from "ai";

import policyJson from "./tools-data/policy.json";
import {
	issueConfirmationToken,
	verifyAndConsume,
} from "./confirmation-token";
import { insertAuditRow } from "@/lib/db/agent-gateway-audit";
import { getAllServices } from "@/lib/db/service";
import { readEnvFile } from "@/lib/secrets/vps-reader";
import {
	systemdAction,
	dockerAction as runDockerAction,
} from "@/lib/runtime/host-ops";

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

type ToolClass = "safe" | "privileged" | "destructive";

interface PolicyToolEntry {
	name: string;
	class: ToolClass;
	description?: string;
	cooldown_seconds?: number;
	rate_limit_per_15min?: number;
}

// ---------------------------------------------------------------------------
// Per-tool sliding-window rate limit (M-9)
//
// In-memory map keyed by `${userId}|${toolName}` -> timestamps (ms) of recent
// calls. Each `checkRateLimit` call drops entries older than 15min, then
// compares the remaining length against the policy's `rate_limit_per_15min`.
//
// Mirrors the per-user/global limiter in /api/ai/chat: module-scope, per
// process, lost on restart. Acceptable for v1.0 single-node systemd deploy.
// TODO(v1.1): swap for a Redis/Valkey-backed sliding window once a shared KV
// is available so multi-worker deploys cannot bypass per-tool caps.
// ---------------------------------------------------------------------------

const RATE_WINDOW_MS = 15 * 60 * 1_000;
const rateBuckets = new Map<string, number[]>();

function rateLimitOf(name: string): number | undefined {
	return POLICY_BY_NAME.get(name)?.rate_limit_per_15min;
}

interface RateLimitDecision {
	allowed: boolean;
	limit?: number;
	retryAfterSeconds?: number;
}

function rateBucketKey(userId: number, toolName: string): string {
	return `${userId}|${toolName}`;
}

function checkAndRecordRateLimit(
	userId: number,
	toolName: string,
	now = Date.now(),
): RateLimitDecision {
	const limit = rateLimitOf(toolName);
	if (limit === undefined || limit <= 0) return { allowed: true };
	const key = rateBucketKey(userId, toolName);
	const cutoff = now - RATE_WINDOW_MS;
	const previous = rateBuckets.get(key) ?? [];
	const within = previous.filter((t) => t > cutoff);
	if (within.length >= limit) {
		const oldest = within[0] ?? now;
		const retryAfterSeconds = Math.max(
			1,
			Math.ceil((oldest + RATE_WINDOW_MS - now) / 1_000),
		);
		// Persist trimmed window so we don't keep stale entries forever.
		rateBuckets.set(key, within);
		return { allowed: false, limit, retryAfterSeconds };
	}
	within.push(now);
	rateBuckets.set(key, within);
	return { allowed: true, limit };
}

/** Test-only reset of all per-tool rate-limit buckets. */
export function _resetToolRateLimits(): void {
	rateBuckets.clear();
}

interface Policy {
	policy_version: number;
	tools: PolicyToolEntry[];
}

const POLICY = policyJson as unknown as Policy;
const POLICY_VERSION = POLICY.policy_version;

const POLICY_BY_NAME = new Map<string, PolicyToolEntry>(
	POLICY.tools.map((t) => [t.name, t]),
);

function classOf(name: string): ToolClass {
	const entry = POLICY_BY_NAME.get(name);
	return entry?.class ?? "safe";
}

function cooldownSecondsOf(name: string): number {
	return POLICY_BY_NAME.get(name)?.cooldown_seconds ?? 0;
}

// ---------------------------------------------------------------------------
// Cooldown tracker (in-memory; per-tool)
// ---------------------------------------------------------------------------

const lastInvokedAt = new Map<string, number>();

function cooldownRemainingMs(name: string, now = Date.now()): number {
	const cd = cooldownSecondsOf(name);
	if (!cd) return 0;
	const last = lastInvokedAt.get(name);
	if (!last) return 0;
	const elapsed = now - last;
	const window = cd * 1_000;
	return elapsed >= window ? 0 : window - elapsed;
}

function markInvoked(name: string, now = Date.now()): void {
	lastInvokedAt.set(name, now);
}

/** Test-only reset. */
export function _resetToolCooldowns(): void {
	lastInvokedAt.clear();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	const o = value as Record<string, unknown>;
	const keys = Object.keys(o).sort();
	return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}

function sha256(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

export interface ToolContext {
	sessionId: string;
	userId: number;
}

interface ConfirmationRequiredResult {
	kind: "confirmation_required";
	tool: string;
	args: Record<string, unknown>;
	token: string;
	approvalId: string;
	expiresAt: string;
}

interface DeniedResult {
	kind: "denied";
	reason: string;
	retryAfterSeconds?: number;
}

// ---------------------------------------------------------------------------
// Confirmation wrapper
// ---------------------------------------------------------------------------

async function ensureApproval(
	ctx: ToolContext,
	toolName: string,
	args: Record<string, unknown>,
): Promise<
	| { kind: "ok" }
	| ConfirmationRequiredResult
	| DeniedResult
> {
	const klass = classOf(toolName);

	// Per-tool sliding-window rate limit (M-9). Applies to every class —
	// including safe — so noisy callers cannot bypass the cap with read-only
	// tools. Tools without a `rate_limit_per_15min` policy entry are
	// unrestricted (preserves current behavior).
	const rate = checkAndRecordRateLimit(ctx.userId, toolName);
	if (!rate.allowed) {
		const argsHashForAudit = sha256(canonicalJson(args));
		await writeAudit({
			ctx,
			toolName,
			toolClass: klass,
			argsHash: argsHashForAudit,
			decision: "deny",
			result: "denied",
			decisionReason: "rate_limit_exceeded",
		});
		return {
			kind: "denied",
			reason: "rate_limited",
			retryAfterSeconds: rate.retryAfterSeconds,
		};
	}

	if (klass === "safe") return { kind: "ok" };

	const argsHash = sha256(canonicalJson(args));
	const { confirmationToken, ...rest } = args as {
		confirmationToken?: string;
		[k: string]: unknown;
	};
	const sanitisedArgs = rest as Record<string, unknown>;
	const sanitisedHash = sha256(canonicalJson(sanitisedArgs));

	if (!confirmationToken) {
		// Cooldown check before issuing a token to avoid prompting when blocked.
		const remaining = cooldownRemainingMs(toolName);
		if (remaining > 0) {
			await writeAudit({
				ctx,
				toolName,
				toolClass: klass,
				argsHash: sanitisedHash,
				decision: "deny",
				result: "denied",
				decisionReason: `cooldown ${Math.ceil(remaining / 1000)}s remaining`,
			});
			return {
				kind: "denied",
				reason: `Cooldown active: ${Math.ceil(remaining / 1000)}s remaining`,
			};
		}
		const issued = issueConfirmationToken({
			sessionId: ctx.sessionId,
			toolName,
			toolClass: klass,
			argsHash: sanitisedHash,
			userId: ctx.userId,
		});
		await writeAudit({
			ctx,
			toolName,
			toolClass: klass,
			argsHash: sanitisedHash,
			approvalId: issued.approvalId,
			nonce: issued.nonce,
			decision: "prompt",
			result: "ok",
		});
		return {
			kind: "confirmation_required",
			tool: toolName,
			args: sanitisedArgs,
			token: issued.token,
			approvalId: issued.approvalId,
			expiresAt: issued.expiresAt.toISOString(),
		};
	}

	const verify = await verifyAndConsume({
		token: confirmationToken,
		sessionId: ctx.sessionId,
		toolName,
		argsHash: sanitisedHash,
		userId: ctx.userId,
	});
	if (!verify.ok) {
		await writeAudit({
			ctx,
			toolName,
			toolClass: klass,
			argsHash: sanitisedHash,
			decision: "deny",
			result: "denied",
			decisionReason: verify.reason,
		});
		return { kind: "denied", reason: verify.reason };
	}

	const remaining = cooldownRemainingMs(toolName);
	if (remaining > 0) {
		await writeAudit({
			ctx,
			toolName,
			toolClass: klass,
			argsHash: sanitisedHash,
			approvalId: verify.approvalId,
			decision: "deny",
			result: "denied",
			decisionReason: `cooldown ${Math.ceil(remaining / 1000)}s remaining`,
		});
		return {
			kind: "denied",
			reason: `Cooldown active: ${Math.ceil(remaining / 1000)}s remaining`,
		};
	}

	await writeAudit({
		ctx,
		toolName,
		toolClass: klass,
		argsHash,
		approvalId: verify.approvalId,
		decision: "allow",
		result: "ok",
	});
	markInvoked(toolName);
	return { kind: "ok" };
}

interface AuditWriteInput {
	ctx: ToolContext;
	toolName: string;
	toolClass: ToolClass;
	argsHash: string;
	approvalId?: string;
	nonce?: string;
	decision: "allow" | "deny" | "prompt";
	result: "ok" | "err" | "timeout" | "denied";
	decisionReason?: string;
}

async function writeAudit(input: AuditWriteInput): Promise<void> {
	await insertAuditRow({
		actor_user_id: input.ctx.userId,
		session_id: input.ctx.sessionId,
		tool: input.toolName,
		tool_class: input.toolClass,
		args_hash: input.argsHash,
		approval_id: input.approvalId ?? null,
		nonce: input.nonce ?? null,
		policy_version: POLICY_VERSION,
		decision: input.decision,
		decision_reason: input.decisionReason ?? null,
		result: input.result,
	}).catch(() => {});
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

const confirmationField = z.string().optional().describe(
	"Confirmation token returned by a previous call. Required for privileged or destructive tools.",
);

export function getAllTools(ctx: ToolContext): Record<string, Tool> {
	const vpsStatus = tool({
		description:
			"Read live VPS service health/status. Returns the registry of active services.",
		inputSchema: z.object({
			service: z.string().optional().describe("Optional slug filter"),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const args = { ...input } as Record<string, unknown>;
			const approval = await ensureApproval(ctx, "vps_status", args);
			if (approval.kind !== "ok") return approval;
			const all = await getAllServices();
			const filtered = input.service
				? all.filter((s) => s.slug === input.service)
				: all;
			return {
				kind: "ok" as const,
				services: filtered.map((s) => ({
					slug: s.slug,
					name: s.name,
					status: s.status,
					category: s.category,
					last_check_at: s.last_check_at,
					response_ms: s.response_ms,
				})),
			};
		},
	});

	const memorySearch = tool({
		description:
			"Search the OpenViking unified memory store. Returns stub data until the OpenViking plugin is live.",
		inputSchema: z.object({
			query: z.string().min(1),
			limit: z.number().int().min(1).max(50).optional(),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const approval = await ensureApproval(
				ctx,
				"memory_search",
				input as Record<string, unknown>,
			);
			if (approval.kind !== "ok") return approval;
			return {
				kind: "stub" as const,
				note: "wire after OpenViking plugin live",
				query: input.query,
			};
		},
	});

	const leannQuery = tool({
		description: "Query the LEANN doc RAG index. Stubbed pending plugin wiring.",
		inputSchema: z.object({
			query: z.string().min(1),
			top_k: z.number().int().min(1).max(20).optional(),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const approval = await ensureApproval(
				ctx,
				"leann_query",
				input as Record<string, unknown>,
			);
			if (approval.kind !== "ok") return approval;
			return {
				kind: "stub" as const,
				note: "wire after LEANN plugin live",
				query: input.query,
			};
		},
	});

	const envRead = tool({
		description: "Read a masked env file from an allowlisted path on the VPS.",
		inputSchema: z.object({
			path: z.string().min(1),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const approval = await ensureApproval(
				ctx,
				"env_read",
				input as Record<string, unknown>,
			);
			if (approval.kind !== "ok") return approval;
			const lines = await readEnvFile(input.path);
			return {
				kind: "ok" as const,
				lines: lines.map((l) => ({
					line: l.line,
					key: l.key,
					value: "masked" in l && l.masked !== undefined ? l.masked : l.value,
					type: l.type,
				})),
			};
		},
	});

	const envDiffPropose = tool({
		description:
			"Propose a diff to an env file. Returns proposed changes; does not write until confirmed via env-writer endpoint.",
		inputSchema: z.object({
			path: z.string().min(1),
			updates: z.array(
				z.object({
					key: z.string().min(1),
					value: z.string(),
				}),
			),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const approval = await ensureApproval(
				ctx,
				"env_diff_propose",
				input as Record<string, unknown>,
			);
			if (approval.kind !== "ok") return approval;
			return {
				kind: "proposed" as const,
				path: input.path,
				updates: input.updates,
			};
		},
	});

	const serviceRestart = tool({
		description:
			"Restart a systemd service on the VPS. Requires confirmation token and is subject to per-tool cooldown.",
		inputSchema: z.object({
			service_name: z.string().min(1),
			confirmation_slug: z.string().optional(),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const approval = await ensureApproval(
				ctx,
				"service_restart",
				input as Record<string, unknown>,
			);
			if (approval.kind !== "ok") return approval;
			const out = await systemdAction("restart", input.service_name, ctx);
			return { kind: "ok" as const, ...out };
		},
	});

	const dockerActionTool = tool({
		description:
			"Perform a Docker action (start/stop/restart/prune) on a container or stack.",
		inputSchema: z.object({
			action: z.enum(["start", "stop", "restart", "prune"]),
			target: z.string().min(1),
			confirmation_slug: z.string().optional(),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const approval = await ensureApproval(
				ctx,
				"docker_action",
				input as Record<string, unknown>,
			);
			if (approval.kind !== "ok") return approval;
			const out = await runDockerAction(input.action, input.target, ctx);
			return { kind: "ok" as const, ...out };
		},
	});

	return {
		vps_status: vpsStatus,
		memory_search: memorySearch,
		leann_query: leannQuery,
		env_read: envRead,
		env_diff_propose: envDiffPropose,
		service_restart: serviceRestart,
		docker_action: dockerActionTool,
	};
}
