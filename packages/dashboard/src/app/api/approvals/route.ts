import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ApprovalRequest {
	id: string;
	actor: string;
	tool: string;
	summary: string;
	args_preview: string;
	requested_at: string;
	status: "pending" | "approved" | "denied";
	reason?: string;
}

interface PendingApprovalRow {
	id: string;
	run_id: string;
	signal_name: string;
	role: string | null;
	issue_id: string | null;
	reason: string | null;
	requested_at: string;
	decision: string | null;
}

function mapStatus(decision: string | null): "pending" | "approved" | "denied" {
	if (decision === "approve") return "approved";
	if (decision === "deny") return "denied";
	return "pending";
}

export async function POST(request: Request): Promise<Response> {
	try {
		const body = await request.json() as { id?: unknown; decision?: unknown; reason?: unknown };
		const { id, decision } = body;
		const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
		if (!id || typeof id !== "string") {
			return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
		}
		if (decision !== "approve" && decision !== "deny") {
			return NextResponse.json({ error: "decision must be \"approve\" or \"deny\"" }, { status: 400 });
		}
		await query(
			`UPDATE pending_approvals
			    SET resolved_at = now(), decision = $1, reason = COALESCE($3, reason)
			  WHERE id::text = $2 AND resolved_at IS NULL`,
			[decision, id, reason],
		);
		return NextResponse.json({ success: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to update approval";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function GET(): Promise<Response> {
	try {
		const rows = await query<PendingApprovalRow>(
			`SELECT id::text, run_id, signal_name, role, issue_id, reason,
			        requested_at::text, decision
			 FROM pending_approvals
			 ORDER BY requested_at DESC
			 LIMIT 200`,
		);

		const approvals: ApprovalRequest[] = rows.map((row) => ({
			id: row.id,
			actor: row.role ?? "",
			tool: row.signal_name,
			summary: row.issue_id ?? "",
			args_preview: row.run_id,
			requested_at: row.requested_at,
			status: mapStatus(row.decision),
			...(row.reason != null ? { reason: row.reason } : {}),
		}));

		return NextResponse.json({ approvals });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to load approvals";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
