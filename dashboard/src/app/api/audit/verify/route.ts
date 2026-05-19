/**
 * V9 — audit-chain on-demand verification endpoint.
 *
 * GET /api/audit/verify?from=<ISO>&to=<ISO>
 *   200 { valid: boolean, count: number, brokenAt?: {...}, firstId?, lastId? }
 *   400 invalid query
 *   401/403 unauthorized
 *
 * Wraps `@cortexos/audit#verifyChain` and reuses the dashboard pg pool so
 * connection budgets are shared. The audit viewer page hits this route to
 * compute the chain-verify badge for the current paginated window.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { pool as dashboardPool } from "@/lib/db/client";
import { verifyChain, setPool } from "@cortexos/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let poolBound = false;
function ensurePoolBound() {
	if (!poolBound) {
		setPool(dashboardPool());
		poolBound = true;
	}
}

const isoDate = z
	.string()
	.datetime({ offset: true })
	.transform((s) => new Date(s));

const querySchema = z.object({
	from: isoDate.optional(),
	to: isoDate.optional(),
});

export async function GET(request: Request) {
	const auth = await requireAdmin(request, { tool: "audit.verify" });
	if (auth.error) return auth.error;

	ensurePoolBound();

	const { searchParams } = new URL(request.url);
	const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid query parameters", code: "EVALIDATION" },
			{ status: 400 },
		);
	}

	try {
		const result = await verifyChain(parsed.data.from, parsed.data.to);
		return NextResponse.json(result);
	} catch (e) {
		const msg = e instanceof Error ? e.message : "unknown error";
		return NextResponse.json(
			{ error: "verify_failed", reason: msg },
			{ status: 500 },
		);
	}
}
