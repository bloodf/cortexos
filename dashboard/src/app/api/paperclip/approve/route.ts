/**
 * V12 — POST /api/paperclip/approve.
 *
 * Publishes a NATS signal at `cortex.signals.<runId>.<signalName>` so the
 * consumer's `awaitSignal(...)` call resolves. Marks the matching row in
 * `pending_approvals` as resolved. Admin-gated; CORTEX_NATS_HMAC required.
 */
import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
// @ts-expect-error — workspace JS package
import { envelope as buildCloudEvent, validate as validateCloudEvent } from "@cortexos/events";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db/client";
import { approvalSignalInputSchema, parseInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jcs(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
	const keys = Object.keys(value as Record<string, unknown>).sort();
	return `{${keys
		.map(
			(k) =>
				`${JSON.stringify(k)}:${jcs((value as Record<string, unknown>)[k])}`,
		)
		.join(",")}}`;
}

function signEnvelope(data: unknown, secret: string): { data: unknown; sig: string } {
	const sig = createHmac("sha256", secret).update(jcs(data)).digest("hex");
	return { data, sig };
}

interface NatsLike {
	publish(subject: string, data: Uint8Array): void;
	isClosed?(): boolean;
}

let cachedNc: NatsLike | null = null;
let connecting: Promise<NatsLike> | null = null;

async function getNats(): Promise<NatsLike | null> {
	if (cachedNc && (!cachedNc.isClosed || !cachedNc.isClosed())) return cachedNc;
	if (connecting) return connecting;
	const url = process.env.NATS_URL;
	if (!url) return null;
	connecting = (async () => {
		const mod = (await import("nats")) as unknown as {
			connect: (opts: Record<string, unknown>) => Promise<NatsLike>;
		};
		const nc = await mod.connect({
			servers: url,
			reconnect: true,
			maxReconnectAttempts: -1,
			reconnectTimeWait: 1_000,
			name: "cortex-dashboard-approvals",
		});
		cachedNc = nc;
		connecting = null;
		return nc;
	})().catch((e) => {
		connecting = null;
		throw e;
	});
	return connecting;
}

export async function POST(request: Request): Promise<Response> {
	const auth = await requireAdmin(request, { tool: "paperclip.approve" });
	if (auth.error) return auth.error;

	const url = process.env.NATS_URL;
	const hmac = process.env.CORTEX_NATS_HMAC;
	if (!url) {
		return NextResponse.json(
			{ error: "NATS_URL not configured" },
			{ status: 503 },
		);
	}
	if (!hmac) {
		return NextResponse.json(
			{ error: "CORTEX_NATS_HMAC not configured" },
			{ status: 503 },
		);
	}

	const rawBody = (await request.json().catch(() => null)) as unknown;
	const parsed = parseInput(approvalSignalInputSchema, rawBody ?? {}, {
		action: "paperclip.approve",
	});
	if (!parsed.ok) {
		return NextResponse.json(
			{ error: parsed.error, issues: parsed.issues },
			{ status: 400 },
		);
	}
	const { runId, signalName, decision, reason } = parsed.data;
	const subject = `cortex.signals.${runId}.${signalName}`;
	const approver = auth.session?.username || "unknown";
	const ts = new Date().toISOString();
	const data = {
		runId,
		signalName,
		decision,
		approver,
		ts,
		...(reason ? { reason } : {}),
	};

	let ce: unknown;
	try {
		ce = buildCloudEvent({
			type: `cortex.signal.${signalName}.${runId}.v1`,
			source: "cortex-dashboard",
			subject: runId,
			data,
		});
		try {
			validateCloudEvent(ce);
		} catch {
			/* best-effort — schema fields validated by zod above */
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return NextResponse.json({ error: msg }, { status: 500 });
	}

	try {
		const nc = await getNats();
		if (!nc) {
			return NextResponse.json(
				{ error: "NATS client unavailable" },
				{ status: 503 },
			);
		}
		const envelope = signEnvelope(ce, hmac);
		const encoded = new TextEncoder().encode(JSON.stringify(envelope));
		nc.publish(subject, encoded);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return NextResponse.json({ error: msg }, { status: 500 });
	}

	// Best-effort row update — never block on Postgres for the signal itself.
	try {
		await query(
			`UPDATE pending_approvals
				SET resolved_at = now(), decision = $1, approver = $2
				WHERE run_id = $3 AND signal_name = $4 AND resolved_at IS NULL`,
			[decision, approver, runId, signalName],
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		process.stderr.write(`[approve] pg update failed: ${msg}\n`);
	}

	return NextResponse.json({ ok: true, subject, ts, decision, approver });
}
