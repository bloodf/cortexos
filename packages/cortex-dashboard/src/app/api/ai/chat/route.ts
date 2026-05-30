/**
 * /api/ai/chat — Cortex chat streaming endpoint.
 *
 * - Admin gate via requireAdmin (PAM users in the cortexos-admin/sudo groups).
 * - In-memory rate limiting: 60 req / 15min per user, 300 / 15min global.
 *   TODO: swap for Redis/Valkey-backed store before multi-worker deployment.
 * - Streams via Vercel AI SDK `streamText` against 9Router (openai-compatible).
 * - Persists messages to `chat_sessions.messages` jsonb via `appendChatMessages`.
 */

import { streamText, type ModelMessage } from "ai";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import {
	getNineRouterModel,
	AIProviderConfigError,
} from "@/lib/ai/provider-resolver";
import { getAllTools } from "@/lib/ai/tools";
import { deriveCortexSessionId } from "@/lib/ai/session-binding";
import { insertAuditRow } from "@/lib/db/dashboard-audit";
import {
	appendChatMessages,
	type ChatMessage as DBChatMessage,
} from "@/lib/db/chat-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Rate limiter — in-memory, per-user + global.
//
// LIMITATION (v1.0, single-node systemd deploy): buckets are module-scope and
// per-process. Counts reset on dashboard restart, on Next.js route-segment
// hot-reload, and are NOT shared across multiple worker processes. The
// "global 300/15min" cap is therefore per-process, not per-cluster.
// Multi-node deployments must front-end this with Redis/Valkey.
// Tracked as v1.1 follow-up.
// ---------------------------------------------------------------------------

const PER_USER_LIMIT = 60;
const GLOBAL_LIMIT = 300;
const WINDOW_MS = 15 * 60 * 1000;

interface Bucket {
	count: number;
	windowStart: number;
}

const userBuckets = new Map<number, Bucket>();
const globalBucket: Bucket = { count: 0, windowStart: Date.now() };

interface RateCheck {
	allowed: boolean;
	retryAfterSec: number;
	scope?: "user" | "global";
}

function checkRate(userId: number): RateCheck {
	const now = Date.now();
	if (now - globalBucket.windowStart > WINDOW_MS) {
		globalBucket.count = 0;
		globalBucket.windowStart = now;
	}
	let ub = userBuckets.get(userId);
	if (!ub || now - ub.windowStart > WINDOW_MS) {
		ub = { count: 0, windowStart: now };
		userBuckets.set(userId, ub);
	}
	if (ub.count >= PER_USER_LIMIT) {
		const retry = Math.ceil((ub.windowStart + WINDOW_MS - now) / 1000);
		return { allowed: false, retryAfterSec: Math.max(retry, 1), scope: "user" };
	}
	if (globalBucket.count >= GLOBAL_LIMIT) {
		const retry = Math.ceil((globalBucket.windowStart + WINDOW_MS - now) / 1000);
		return { allowed: false, retryAfterSec: Math.max(retry, 1), scope: "global" };
	}
	ub.count += 1;
	globalBucket.count += 1;
	return { allowed: true, retryAfterSec: 0 };
}

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const messageSchema = z.object({
	role: z.enum(["system", "user", "assistant", "tool"]),
	content: z.union([
		z.string(),
		z.array(z.unknown()),
	]),
});

const bodySchema = z.object({
	messages: z.array(messageSchema).min(1),
	modelId: z.string().optional(),
	sessionId: z.string().min(1),
});

function jsonError(status: number, code: string, message: string, extra?: Record<string, unknown>): Response {
	return new Response(
		JSON.stringify({ error: message, code, ...extra }),
		{ status, headers: { "content-type": "application/json" } },
	);
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "ai.chat" });
	if (auth.error) {
		await insertAuditRow({
			tool: "ai.chat",
			tool_class: "safe",
			args_hash: "denied",
			decision: "deny",
			result: "denied",
		}).catch(() => {});
		return auth.error;
	}

	const userId = auth.session!.user_id;
	const cortexSessionId = deriveCortexSessionId(userId, auth.session!.token);

	// Body validation
	let parsed: z.infer<typeof bodySchema>;
	try {
		const raw = (await request.json()) as unknown;
		parsed = bodySchema.parse(raw);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Invalid request body";
		return jsonError(400, "EBADBODY", message);
	}

	// Rate limit
	const rl = checkRate(userId);
	if (!rl.allowed) {
		return new Response(
			JSON.stringify({
				error: `Rate limit exceeded (${rl.scope}). Retry after ${rl.retryAfterSec}s.`,
				code: "ERATELIMIT",
			}),
			{
				status: 429,
				headers: {
					"content-type": "application/json",
					"retry-after": String(rl.retryAfterSec),
					"x-ratelimit-scope": rl.scope ?? "user",
				},
			},
		);
	}

	// Provider env presence check (mirrors stub behavior so callers get a clear 503).
	if (!process.env.NINEROUTER_BASE_URL || !process.env.NINEROUTER_API_KEY) {
		return jsonError(
			503,
			"ENOPROVIDER",
			"AI provider not configured. Set NINEROUTER_BASE_URL and NINEROUTER_API_KEY.",
		);
	}

	// Persist incoming messages best-effort (do not block the stream on failure).
	const newUserMessages: DBChatMessage[] = parsed.messages
		.filter((m) => m.role === "user")
		.map((m) => ({
			role: "user",
			content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
		}));
	if (newUserMessages.length > 0) {
		await appendChatMessages(userId, newUserMessages).catch(() => {});
	}

	await insertAuditRow({
		actor_user_id: userId,
		session_id: parsed.sessionId,
		tool: "ai.chat",
		tool_class: "safe",
		args_hash: "prompt",
		decision: "prompt",
		result: "ok",
	}).catch(() => {});

	try {
		const model = getNineRouterModel(parsed.modelId);
		// Server-derived sessionId: bound to (userId, session token). Client-supplied
		// parsed.sessionId is kept only as a conversation handle for message
		// persistence; it is NEVER fed into the HMAC payload.
		const tools = getAllTools({ sessionId: cortexSessionId, userId });

		const result = streamText({
			model,
			messages: parsed.messages as ModelMessage[],
			tools,
			stopWhen: () => false,
		});

		return result.toUIMessageStreamResponse();
	} catch (err) {
		const message = err instanceof Error ? err.message : "Internal error";
		await insertAuditRow({
			actor_user_id: userId,
			session_id: parsed.sessionId,
			tool: "ai.chat",
			tool_class: "safe",
			args_hash: "error",
			decision: "deny",
			result: "err",
			decision_reason: message.slice(0, 200),
		}).catch(() => {});
		if (err instanceof AIProviderConfigError) {
			return jsonError(503, "ENOPROVIDER", message);
		}
		return jsonError(500, "EINTERNAL", "Chat request failed");
	}
}
