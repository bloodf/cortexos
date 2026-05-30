/**
 * /api/incus/ai/models — list models discoverable from 9router (admin only).
 * Returns an empty list (not an error) when the provider is unconfigured/down,
 * so the wizard + settings UI degrade gracefully.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { discoverModels } from "@/lib/ai/provider-resolver";

export async function GET(request: Request) {
	const auth = await requireAdmin(request, { tool: "incus.ai.models" });
	if (auth.error) return auth.error;
	if (!process.env.NINEROUTER_BASE_URL || !process.env.NINEROUTER_API_KEY) {
		return NextResponse.json({ data: [], note: "provider not configured" });
	}
	try {
		const ids = await discoverModels();
		return NextResponse.json({ data: ids });
	} catch {
		return NextResponse.json({ data: [], note: "discovery failed" });
	}
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
