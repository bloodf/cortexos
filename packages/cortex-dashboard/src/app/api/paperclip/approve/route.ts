import { NextResponse } from "next/server";
import { append as auditAppend } from "@cortexos/audit";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db/client";
import { approvalSignalInputSchema, parseInput } from "@/lib/validation";

const AUDIT_ENABLED = process.env.CORTEX_AUDIT_ENABLED !== "0";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
	const auth = await requireAdmin(request, { tool: "paperclip.approve" });
	if (auth.error) return auth.error;

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
	const approver = auth.session?.username || "unknown";
	const ts = new Date().toISOString();

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

	if (AUDIT_ENABLED) {
		try {
			await auditAppend({
				event_type: `cortex.dashboard.paperclip.approval.${signalName}`,
				source: "cortex-dashboard",
				subject: runId,
				actor: approver,
				payload: { runId, signalName, decision, approver, ts, ...(reason ? { reason } : {}) },
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			process.stderr.write(`[approve] audit append failed: ${msg}\n`);
		}
	}

	return NextResponse.json({
		ok: true,
		status: "recorded",
		runId,
		signalName,
		ts,
		decision,
		approver,
	});
}
