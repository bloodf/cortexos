import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getActionLog } from "@/lib/db/action-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const auth = await requireAdmin(request, { tool: "action_log.list" });
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const rawLimit = Number(searchParams.get("limit") ?? "100");
	const limit = Number.isFinite(rawLimit) ? rawLimit : 100;

	try {
		const entries = await getActionLog(limit);
		return NextResponse.json({ entries });
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
