/**
 * /api/ai/chat — Cortex chat streaming endpoint.
 *
 * - Admin gate via requireAuth (admin_users is the only kind).
 * - Shared rate limiting via injectable RateLimitStore: 60 req / 15min per user, 300 / 15min global.
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
import { getRateLimitStore } from "@/lib/ai/rate-limit-store";
import { insertAuditRow } from "@/lib/db/agent-gateway-audit";
import {
	appendChatMessages,
	type ChatMessage as DBChatMessage,
} from "@/lib/db/chat-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Rate limiter — injectable store (memory by default; Redis/Valkey adapter can
// be installed at process startup with setRateLimitStore).
// ---------------------------------------------------------------------------

const PER_USER_LIMIT = 60;
const GLOBAL_LIMIT = 300;
const WINDOW_MS = 15 * 60 * 1000;

interface RateCheck {
	allowed: boolean;
	retryAfterSec: number;
	scope?: "user" | "global";
}

async function checkRate(userId: number): Promise<RateCheck> {
	const store = getRateLimitStore();
	const user = await store.check(`ai-chat:user:${userId}`, PER_USER_LIMIT, WINDOW_MS);
	if (!user.allowed) return { ...user, scope: "user" };
	const global = await store.check("ai-chat:global", GLOBAL_LIMIT, WINDOW_MS);
	if (!global.allowed) return { ...global, scope: "global" };
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
	const rl = await checkRate(userId);
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
