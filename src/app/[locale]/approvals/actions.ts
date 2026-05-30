/**
 * V12 — Approvals server actions.
 *
 * Read pending approvals from Postgres and mark decisions locally. External
 * approval buses are intentionally not used in the rebuilt architecture.
 */
"use server";

import { revalidatePath } from "next/cache";
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

export interface DecideResult {
	ok: boolean;
	error?: string;
	validation?: ValidationResult<unknown>;
}

/**
 * Server action invoked by the approve/deny buttons in the page form.
 * Validates input with zod, marks the row resolved, then `revalidatePath` so
 * the list refreshes.
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

	const { runId, signalName, decision, reason } = parsed.data;
	const approver = session.username || "unknown";

	try {
		await query(
			`UPDATE pending_approvals
				SET resolved_at = now(), decision = $1, approver = $2, reason = COALESCE($3, reason)
				WHERE run_id = $4 AND signal_name = $5 AND resolved_at IS NULL`,
			[decision, approver, reason ?? null, runId, signalName],
		);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		process.stderr.write(`[approvals.decide] pg update failed: ${msg}\n`);
	}

	revalidatePath("/[locale]/approvals", "page");
	return { ok: true };
}

/**
 * Void-returning wrapper for use as a `<form action>` prop. Next.js form
 * actions must return `void | Promise<void>`; this discards the structured
 * result and only triggers revalidation.
 */
export async function decideApprovalForm(formData: FormData): Promise<void> {
	await decideApproval(formData);
}
