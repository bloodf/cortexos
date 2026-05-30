import { execute, queryOne } from "./client";

export interface ChatMessage {
	role: "user" | "assistant" | "system" | "tool";
	content: string;
	created_at?: string;
	[k: string]: unknown;
}

export interface ChatSession {
	user_id: number;
	panel_open: boolean;
	width: number;
	messages: ChatMessage[];
	updated_at: Date;
}

export interface UpsertChatSessionInput {
	panel_open?: boolean;
	width?: number;
	messages?: ChatMessage[];
}

const COLUMNS = "user_id, panel_open, width, messages, updated_at";

// H-6: redact tool results carrying masked rows. Same MASK_PATTERN family as
// vps-reader. Anything that looks like a secret-ish key=value gets the value
// replaced with [REDACTED] before persistence.
const SECRET_KEY_RE = /\b(SECRET|TOKEN|KEY|PASSWORD|PASSWD|API[_-]?KEY|HMAC|BEARER|PRIVATE)\b/i;

function redactString(s: string): string {
	if (typeof s !== "string") return s;
	// KEY=value -> KEY=[REDACTED] when KEY looks sensitive
	return s.replace(/([A-Z][A-Z0-9_]*)=([^\s"']+)/g, (m, k, _v) =>
		SECRET_KEY_RE.test(k) ? `${k}=[REDACTED]` : m,
	);
}

function redactMessage(m: ChatMessage): ChatMessage {
	const out: ChatMessage = { ...m };
	if (typeof out.content === "string") {
		out.content = redactString(out.content);
	}
	// Tool result envelopes commonly carry {mask:true, value:...} entries. If a
	// caller already marked a row masked, store [REDACTED] in lieu of value.
	const masked = (out as { masked?: boolean }).masked;
	if (masked === true) {
		(out as { value?: unknown }).value = "[REDACTED]";
	}
	return out;
}

export async function pruneExpired(): Promise<void> {
	await execute("DELETE FROM chat_sessions WHERE expires_at < NOW()");
}

function validateUserId(id: number): void {
	if (!Number.isInteger(id) || id <= 0) {
		throw new Error("user_id must be a positive integer");
	}
}

function validateWidth(w: number): void {
	if (!Number.isInteger(w) || w < 240 || w > 1200) {
		throw new Error("width must be an integer in [240,1200]");
	}
}

export async function getChatSession(
	userId: number,
): Promise<ChatSession | null> {
	validateUserId(userId);
	return queryOne<ChatSession>(
		`SELECT ${COLUMNS} FROM chat_sessions WHERE user_id = $1`,
		[userId],
	);
}

export async function appendChatMessages(
	userId: number,
	newMessages: ChatMessage[],
): Promise<ChatSession> {
	validateUserId(userId);
	if (!Array.isArray(newMessages)) {
		throw new Error("newMessages must be an array");
	}
	const existing = await getChatSession(userId);
	const merged: ChatMessage[] = [
		...(existing?.messages ?? []),
		...newMessages.map((m) =>
			redactMessage({
				...m,
				created_at: m.created_at ?? new Date().toISOString(),
			}),
		),
	];
	return upsertChatSession(userId, { messages: merged });
}

export async function upsertChatSession(
	userId: number,
	patch: UpsertChatSessionInput,
): Promise<ChatSession> {
	validateUserId(userId);
	if (patch.width !== undefined) validateWidth(patch.width);
	if (patch.messages !== undefined && !Array.isArray(patch.messages)) {
		throw new Error("messages must be an array");
	}
	const row = await queryOne<ChatSession>(
		`INSERT INTO chat_sessions (user_id, panel_open, width, messages)
     VALUES ($1, COALESCE($2, false), COALESCE($3, 360), COALESCE($4::jsonb, '[]'::jsonb))
     ON CONFLICT (user_id) DO UPDATE SET
       panel_open = COALESCE($2, chat_sessions.panel_open),
       width = COALESCE($3, chat_sessions.width),
       messages = COALESCE($4::jsonb, chat_sessions.messages),
       updated_at = NOW()
     RETURNING ${COLUMNS}`,
		[
			userId,
			patch.panel_open ?? null,
			patch.width ?? null,
			patch.messages !== undefined ? JSON.stringify(patch.messages) : null,
		],
	);
	if (!row) throw new Error("Failed to upsert chat session");
	return row;
}
