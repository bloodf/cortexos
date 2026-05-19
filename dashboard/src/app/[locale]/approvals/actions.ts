/**
 * V12 — Approvals server actions.
 *
 * Read pending approvals from Postgres (`pending_approvals` table populated
 * by cortex-consumer when entering `awaitSignal`), and submit a decision by
 * calling the same NATS publish path as `/api/paperclip/approve` so the UI
 * action and the API stay symmetric.
 */
"use server";

import { revalidatePath } from "next/cache";
import { createHmac } from "node:crypto";
import { envelope as buildCloudEvent, validate as validateCloudEvent } from "@cortexos/events";
import { query } from "@/lib/db/client";
import { getCurrentSession } from "@/lib/auth";
import {
	approvalSignalInputSchema,
	parseInput,
	type ValidationResult,
} from "@/lib/validation";

export interface PendingApprovalRow {
	id: number;
	run_id: string;
	signal_name: string;
	role: string | null;
	issue_id: string | null;
	reason: string | null;
	requested_at: string;
	timeout_at: string | null;
}

const SELECT_OPEN = `
	SELECT id, run_id, signal_name, role, issue_id, reason,
		requested_at, timeout_at
	FROM pending_approvals
	WHERE resolved_at IS NULL
	ORDER BY requested_at DESC
	LIMIT 200
`;

function isMissingTable(err: unknown): boolean {
	if (!err || typeof err !== "object") return false;
	const code = (err as { code?: string }).code;
	return code === "42P01";
}

export interface LoadPendingResult {
	rows: PendingApprovalRow[];
	warning?: string;
	error?: string;
}

export async function loadPendingApprovals(): Promise<LoadPendingResult> {
	try {
		const rows = await query<PendingApprovalRow>(SELECT_OPEN);
		return { rows };
	} catch (err) {
		if (isMissingTable(err)) {
			return { rows: [], warning: "pending_approvals table not present" };
		}
		const message =
			err instanceof Error ? err.message : "Failed to load pending approvals";
		return { rows: [], error: message };
	}
}

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
			name: "cortex-dashboard-approvals-action",
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

export interface DecideResult {
	ok: boolean;
	error?: string;
	subject?: string;
	validation?: ValidationResult<unknown>;
}

/**
 * Server action invoked by the approve/deny buttons in the page form.
 * Validates input with zod, publishes the signal, marks the row resolved,
 * then `revalidatePath` so the list refreshes.
 */
export async function decideApproval(
	formData: FormData,
): Promise<DecideResult> {
	const raw = {
		runId: String(formData.get("runId") ?? ""),
		signalName: String(formData.get("signalName") ?? "approval"),
		decision: String(formData.get("decision") ?? ""),
		reason: formData.get("reason") ? String(formData.get("reason")) : undefined,
	};
	const parsed = parseInput(approvalSignalInputSchema, raw, {
		action: "approvals.decide",
	});
	if (!parsed.ok) {
		return { ok: false, error: parsed.error, validation: parsed };
	}

	const current = await getCurrentSession().catch(() => null);
	if (!current || !current.user.is_admin) {
		return { ok: false, error: "Forbidden: admin required" };
	}
	const session = current.user;

	const hmac = process.env.CORTEX_NATS_HMAC;
	if (!process.env.NATS_URL || !hmac) {
		return { ok: false, error: "NATS not configured" };
	}

	const { runId, signalName, decision, reason } = parsed.data;
	const subject = `cortex.signals.${runId}.${signalName}`;
	const approver = session.username || "unknown";
	const ts = new Date().toISOString();
	const data = {
		runId,
		signalName,
		decision,
		approver,
		ts,
		...(reason ? { reason } : {}),
	};

	try {
		const ce = buildCloudEvent({
			type: `cortex.signal.${signalName}.${runId}.v1`,
			source: "cortex-dashboard",
			subject: runId,
			data,
		});
		try {
			validateCloudEvent(ce);
		} catch {
			/* best-effort */
		}
		const nc = await getNats();
		if (!nc) return { ok: false, error: "NATS client unavailable" };
		const envelope = signEnvelope(ce, hmac);
		nc.publish(
			subject,
			new TextEncoder().encode(JSON.stringify(envelope)),
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { ok: false, error: msg };
	}

	try {
		await query(
			`UPDATE pending_approvals
				SET resolved_at = now(), decision = $1, approver = $2
				WHERE run_id = $3 AND signal_name = $4 AND resolved_at IS NULL`,
			[decision, approver, runId, signalName],
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		process.stderr.write(`[approvals.decide] pg update failed: ${msg}\n`);
	}

	revalidatePath("/[locale]/approvals", "page");
	return { ok: true, subject };
}

/**
 * Void-returning wrapper for use as a `<form action>` prop. Next.js form
 * actions must return `void | Promise<void>`; this discards the structured
 * result and only triggers revalidation.
 */
export async function decideApprovalForm(formData: FormData): Promise<void> {
	await decideApproval(formData);
}
