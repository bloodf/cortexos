import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { listAudit, countAudit } from "@/lib/db/agent-gateway-audit";
import type { ToolClass, Decision, AuditResult } from "@/lib/db/agent-gateway-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Query validation
// ---------------------------------------------------------------------------

const isoDate = z
	.string()
	.datetime({ offset: true })
	.transform((s) => new Date(s));

const querySchema = z.object({
	actor_user_id: z
		.string()
		.regex(/^\d+$/)
		.transform((s) => parseInt(s, 10))
		.optional(),
	tool: z.string().min(1).max(255).optional(),
	tool_class: z.enum(["safe", "privileged", "destructive"]).optional(),
	decision: z.enum(["allow", "deny", "prompt"]).optional(),
	result: z.enum(["ok", "err", "timeout", "denied"]).optional(),
	from: isoDate.optional(),
	to: isoDate.optional(),
	limit: z
		.string()
		.regex(/^\d+$/)
		.transform((s) => Math.max(1, Math.min(parseInt(s, 10) || 100, 1000)))
		.optional(),
	offset: z
		.string()
		.regex(/^\d+$/)
		.transform((s) => Math.max(0, parseInt(s, 10) || 0))
		.optional(),
});

export async function GET(request: Request) {
	const auth = await requireAdmin(request, { tool: "audit.list" });
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const rawParams = Object.fromEntries(searchParams.entries());

	const parsed = querySchema.safeParse(rawParams);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid query parameters", code: "EVALIDATION" },
			{ status: 400 },
		);
	}

	const q = parsed.data;
	const limit = q.limit ?? 100;
	const offset = q.offset ?? 0;

	try {
		const filters = {
			actor_user_id: q.actor_user_id,
			tool: q.tool,
			tool_class: q.tool_class as ToolClass | undefined,
			decision: q.decision as Decision | undefined,
			result: q.result as AuditResult | undefined,
			since: q.from,
			until: q.to,
		};
		const [rows, total] = await Promise.all([
			listAudit({ ...filters, limit, offset }),
			countAudit(filters),
		]);
		const hasMore = offset + rows.length < total;
		return NextResponse.json({ rows, total, limit, offset, hasMore });
	} catch {
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
