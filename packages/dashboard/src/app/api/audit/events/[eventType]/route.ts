/**
 * Audit ingest collector — the missing sink for the hash-chained audit_log.
 *
 * POST /api/audit/events/:eventType
 *   Body: a CloudEvent-style envelope { data: { event_type, source, subject,
 *         actor, payload, ts } } OR a bare audit event { event_type, source,
 *         subject, actor, payload }.
 *   Auth: Authorization: Bearer <CORTEX_AUDIT_INGEST_TOKEN>.
 *   200 { id, chain_hash }   201 on first row
 *   401 missing/invalid token   400 bad body   500 append failed
 *
 * This is the endpoint the sandbox runner (and any other producer) targets via
 * CORTEX_AUDIT_URL. It wraps `@cortexos/audit#append`, which computes
 * payload_hash (JCS+SHA-256), links chain_hash to the prior tip under a
 * row-level lock, and inserts an append-only row. Token auth is mandatory:
 * an unauthenticated sink would let any caller forge audit history.
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { pool as dashboardPool } from "@/lib/db/client";
import { append, setPool } from "@cortexos/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let poolBound = false;
function ensurePoolBound() {
	if (!poolBound) {
		setPool(dashboardPool());
		poolBound = true;
	}
}

function tokenOk(request: Request): boolean {
	const expected = process.env.CORTEX_AUDIT_INGEST_TOKEN || "";
	if (!expected) return false; // fail closed when unconfigured
	const header = request.headers.get("authorization") || "";
	const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
	if (!presented) return false;
	const a = Buffer.from(presented);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

export async function POST(
	request: Request,
	context: { params: Promise<{ eventType: string }> },
) {
	if (!tokenOk(request)) {
		return NextResponse.json(
			{ error: "unauthorized", code: "EAUTH" },
			{ status: 401 },
		);
	}

	const { eventType } = await context.params;

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "invalid_json", code: "EVALIDATION" },
			{ status: 400 },
		);
	}

	// Accept either a CloudEvent envelope ({data:{...}}) or a bare event.
	const env = body as Record<string, unknown>;
	const inner =
		env && typeof env === "object" && env.data && typeof env.data === "object"
			? (env.data as Record<string, unknown>)
			: env;

	const event = {
		event_type:
			(inner.event_type as string) ||
			(env.type as string) ||
			eventType,
		source: (inner.source as string) || (env.source as string) || "unknown",
		subject: (inner.subject as string | null) ?? null,
		actor: (inner.actor as string | null) ?? null,
		payload: inner.payload ?? inner,
	};

	if (event.payload === undefined || event.payload === null) {
		return NextResponse.json(
			{ error: "payload_required", code: "EVALIDATION" },
			{ status: 400 },
		);
	}

	ensurePoolBound();

	try {
		const row = await append(event);
		return NextResponse.json(
			{ id: row.id, chain_hash: row.chain_hash },
			{ status: 201 },
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "unknown error";
		return NextResponse.json(
			{ error: "append_failed", reason: msg },
			{ status: 500 },
		);
	}
}
