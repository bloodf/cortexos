/**
 * Vercel AI SDK tool registry for the Cortex chat panel.
 *
 * Each tool definition consults the policy (loaded from `tools-data/policy.json`,
 * mirrored from policy data) for its class and rate-limit.
 * Privileged/destructive tools follow the confirmation-token issue/verify dance
 * before executing. Every invocation writes an audit row.
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { tool, type Tool } from "ai";

import policyJson from "./tools-data/policy.json";
import {
	issueConfirmationToken,
	verifyAndConsume,
} from "./confirmation-token";
import { insertAuditRow } from "@/lib/db/tool-audit";
import { getRateLimitStore } from "./rate-limit-store";
import { getAllServices } from "@/lib/db/service";
import { getAgentFactory, upsertAgentFactory } from "@/lib/db/agent-factories";
import type { AgentFactoryKind } from "@/lib/db/agent-factories";
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
// Per-tool sliding-window rate limit via injectable RateLimitStore.
// ---------------------------------------------------------------------------

const RATE_WINDOW_MS = 15 * 60 * 1_000;

function rateLimitOf(name: string): number | undefined {
	return POLICY_BY_NAME.get(name)?.rate_limit_per_15min;
}

interface RateLimitDecision {
	allowed: boolean;
	limit?: number;
	retryAfterSeconds?: number;
}

async function checkAndRecordRateLimit(
	userId: number,
	toolName: string,
): Promise<RateLimitDecision> {
	const limit = rateLimitOf(toolName);
	if (limit === undefined || limit <= 0) return { allowed: true };
	const result = await getRateLimitStore().check(`tool:${userId}:${toolName}`, limit, RATE_WINDOW_MS);
	return {
		allowed: result.allowed,
		limit,
		retryAfterSeconds: result.retryAfterSec,
	};
}

/** Test-only reset of all per-tool rate-limit buckets. */
export function _resetToolRateLimits(): void {
	getRateLimitStore().reset?.();
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
	const rate = await checkAndRecordRateLimit(ctx.userId, toolName);
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

const factoryKindSchema = z.enum(["role", "workflow", "pipeline", "project"]);
const jsonRecordSchema = z.record(z.string(), z.any());

function hermesBase(): string {
	return process.env.HERMES_PROFILES_ROOT || "/opt/cortexos/hermes/profiles";
}

function renderFactoryProfileConfig(model = "cx/gpt-5.5"): string {
	return [
		"model:",
		`  default: ${model}`,
		"  provider: 9router",
		"  base_url: ${NINEROUTER_BASE_URL}",
		"  api_mode: chat_completions",
		"providers:",
		"  9router:",
		"    name: 9Router",
		"    api: ${NINEROUTER_BASE_URL}",
		"    key_env: NINEROUTER_API_KEY",
		"    transport: openai_chat",
		"agent:",
		"  max_turns: 120",
		"mcp_servers:",
		"  filesystem:",
		"    command: sh",
		"    args: [\"-lc\", \"exec npx -y @modelcontextprotocol/server-filesystem ${MCP_FILESYSTEM_ROOTS}\"]",
		"  agentgateway:",
		"    command: node",
		"    args: [\"${CORTEX_AGENTGATEWAY_MCP_BIN}\"]",
		"    env:",
		"      AGENTGATEWAY_MCP_CONFIG: ${AGENTGATEWAY_MCP_CONFIG}",
		"      AGENTGATEWAY_MCP_TIMEOUT_MS: ${AGENTGATEWAY_MCP_TIMEOUT_MS}",
		"",
	].join("\n");
}

function slugify(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "agent";
}

function projectPositions(definition: Record<string, unknown>): Array<Record<string, unknown>> {
	const paperclip = definition.paperclip;
	if (!paperclip || typeof paperclip !== "object") return [];
	const p = paperclip as Record<string, unknown>;
	return [
		...(Array.isArray(p.required_positions) ? p.required_positions : []),
		...(Array.isArray(p.optional_positions) ? p.optional_positions : []),
	].filter((item): item is Record<string, unknown> => item !== null && typeof item === "object");
}

async function postPaperclipPromotion(factorySlug: string, payload: Record<string, unknown>) {
	const apiUrl = process.env.PAPERCLIP_API_URL?.replace(/\/+$/, "");
	const apiKey = process.env.PAPERCLIP_API_KEY;
	if (!apiUrl || !apiKey) {
		return { skipped: true, reason: "PAPERCLIP_API_URL/PAPERCLIP_API_KEY not configured" };
	}
	const res = await fetch(`${apiUrl}/api/cortex/factories/${encodeURIComponent(factorySlug)}/promote`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify(payload),
	});
	return { skipped: false, ok: res.ok, status: res.status, body: await res.text().catch(() => "") };
}

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
			"Search the Honcho memory store. Returns a stub until the Honcho API search endpoint is configured.",
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
				note: "wire after Honcho search endpoint is configured",
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

	const proposeRole = tool({
		description: "Generate a role factory proposal for a Hermes/Paperclip agent.",
		inputSchema: z.object({
			title: z.string().min(1),
			description: z.string().min(1),
			role: z.string().optional(),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const approval = await ensureApproval(ctx, "propose_role", input as Record<string, unknown>);
			if (approval.kind !== "ok") return approval;
			const role = input.role || slugify(input.title).toUpperCase();
			return {
				kind: "proposal" as const,
				factory: {
					slug: `role-${slugify(role)}`,
					name: input.title,
					kind: "role",
					definition: {
						role,
						files: {
							"ROLE.md": `# ${input.title}\n\n${input.description}\n`,
							"WORKFLOW.md": `# ${input.title} Workflow\n\n- Review assigned Paperclip/Hermes work.\n- Produce concise status updates.\n- Escalate blocked or destructive actions.\n`,
						},
					},
				},
			};
		},
	});

	const proposeWorkflow = tool({
		description: "Generate a workflow proposal for an agent factory.",
		inputSchema: z.object({
			factory_slug: z.string().min(1),
			goal: z.string().min(1).optional(),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const approval = await ensureApproval(ctx, "propose_workflow", input as Record<string, unknown>);
			if (approval.kind !== "ok") return approval;
			return {
				kind: "proposal" as const,
				factory_slug: input.factory_slug,
				workflow: {
					"WORKFLOW.md": `# Workflow\n\nGoal: ${input.goal || "Create, validate, and promote the generated agent files."}\n\n1. Draft roles and project seats.\n2. Validate required Markdown files.\n3. Promote to Hermes and Paperclip.\n`,
				},
			};
		},
	});

	const proposePipeline = tool({
		description: "Generate a promotion pipeline proposal for an agent factory.",
		inputSchema: z.object({
			factory_slug: z.string().min(1),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const approval = await ensureApproval(ctx, "propose_pipeline", input as Record<string, unknown>);
			if (approval.kind !== "ok") return approval;
			return {
				kind: "proposal" as const,
				factory_slug: input.factory_slug,
				pipeline: ["validate_factory", "save_factory", "agent_factory_promote"],
			};
		},
	});

	const saveFactory = tool({
		description: "Persist an agent factory definition to the database.",
		inputSchema: z.object({
			slug: z.string().min(1),
			name: z.string().min(1),
			kind: factoryKindSchema,
			schema_version: z.number().int().positive().optional(),
			definition: jsonRecordSchema.optional(),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const approval = await ensureApproval(ctx, "save_factory", input as Record<string, unknown>);
			if (approval.kind !== "ok") return approval;
			const factory = await upsertAgentFactory({
				slug: input.slug,
				name: input.name,
				kind: input.kind as AgentFactoryKind,
				schema_version: input.schema_version,
				definition: input.definition ?? {},
				created_by: `user:${ctx.userId}`,
			});
			return { kind: "ok" as const, factory };
		},
	});

	const validateFactory = tool({
		description: "Validate a factory definition before promotion.",
		inputSchema: z.object({
			factory_slug: z.string().optional(),
			definition: jsonRecordSchema.optional(),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const approval = await ensureApproval(ctx, "validate_factory", input as Record<string, unknown>);
			if (approval.kind !== "ok") return approval;
			const factory = input.factory_slug ? await getAgentFactory(input.factory_slug) : null;
			const definition = input.definition ?? factory?.definition ?? {};
			const positions = projectPositions(definition);
			const files = definition.files && typeof definition.files === "object" ? definition.files : null;
			const errors: string[] = [];
			if (!factory && !input.definition) errors.push("factory_slug or definition is required");
			if (positions.length === 0 && !files) errors.push("definition must include paperclip positions or files");
			return { kind: errors.length === 0 ? "valid" as const : "invalid" as const, errors, positions: positions.length };
		},
	});

	const dryRunDispatch = tool({
		description: "Simulate factory promotion without writing files.",
		inputSchema: z.object({
			factory_slug: z.string().min(1),
			project_slug: z.string().optional(),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const approval = await ensureApproval(ctx, "dry_run_dispatch", input as Record<string, unknown>);
			if (approval.kind !== "ok") return approval;
			const factory = await getAgentFactory(input.factory_slug);
			if (!factory) return { kind: "not_found" as const, factory_slug: input.factory_slug };
			const projectSlug = input.project_slug || slugify(factory.name);
			const positions = projectPositions(factory.definition);
			return {
				kind: "dry_run" as const,
				factory_slug: factory.slug,
				targets: positions.map((position) => `${projectSlug}-${String(position.seat || position.paperclip_role || "agent")}`),
			};
		},
	});

	const promoteFactory = tool({
		description: "Promote a saved factory to Hermes profile files and Paperclip.",
		inputSchema: z.object({
			factory_slug: z.string().min(1),
			project_slug: z.string().optional(),
			call_paperclip: z.boolean().optional(),
			confirmationToken: confirmationField,
		}),
		execute: async (input) => {
			const approval = await ensureApproval(ctx, "agent_factory_promote", input as Record<string, unknown>);
			if (approval.kind !== "ok") return approval;
			const factory = await getAgentFactory(input.factory_slug);
			if (!factory) return { kind: "not_found" as const, factory_slug: input.factory_slug };
				const projectSlug = input.project_slug || slugify(factory.name);
				const positions = projectPositions(factory.definition);
				if (positions.length === 0) {
					return { kind: "empty" as const, factory_slug: factory.slug, reason: "factory definition has no Paperclip positions" };
				}
				const written: string[] = [];
			const registered: string[] = [];
			const projectHome = join(hermesBase(), projectSlug);
			await mkdir(projectHome, { recursive: true });
			await writeFile(join(projectHome, "config.yaml"), renderFactoryProfileConfig(), "utf-8");
			written.push(join(projectHome, "config.yaml"));
			for (const position of positions) {
				const seat = slugify(String(position.seat || position.paperclip_role || position.title || "agent"));
				const agentSlug = `${projectSlug}-${seat}`;
				const dir = join(hermesBase(), projectSlug, "agents", agentSlug);
				await mkdir(dir, { recursive: true });
				const title = String(position.title || position.paperclip_role || seat);
				const role = String(position.paperclip_role || title);
				const files = {
					"ROLE.md": `# ${title}\n\nPaperclip role: ${role}\nFactory: ${factory.slug}\n`,
					"WORKFLOW.md": `# ${title} Workflow\n\n- Accept work from Paperclip.\n- Execute through the ${projectSlug} Hermes profile.\n- Ask for approval before destructive actions.\n`,
					"AGENTS.md": `# ${title}\n\nYou are the ${title} agent for ${projectSlug}. Follow ROLE.md and WORKFLOW.md.\n`,
				};
				for (const [name, content] of Object.entries(files)) {
					const filePath = join(dir, name);
					await writeFile(filePath, content, "utf-8");
					written.push(filePath);
				}
				registered.push(`hermes:${projectSlug}:${agentSlug}`);
			}
			const paperclip = input.call_paperclip === false
				? { skipped: true, reason: "disabled by request" }
				: await postPaperclipPromotion(factory.slug, { projectSlug, positions });
			return { kind: "ok" as const, factory_slug: factory.slug, written, registered, paperclip };
		},
	});

	return {
		vps_status: vpsStatus,
		memory_search: memorySearch,
		env_read: envRead,
		env_diff_propose: envDiffPropose,
		service_restart: serviceRestart,
		docker_action: dockerActionTool,
		propose_role: proposeRole,
		propose_workflow: proposeWorkflow,
		propose_pipeline: proposePipeline,
		save_factory: saveFactory,
		validate_factory: validateFactory,
		dry_run_dispatch: dryRunDispatch,
		agent_factory_promote: promoteFactory,
	};
}
