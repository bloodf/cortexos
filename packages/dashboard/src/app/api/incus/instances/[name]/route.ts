/**
 * /api/incus/instances/[name] — GET saved config (+ live status), DELETE row.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { hostExecFile } from "@/lib/host-exec";
import {
	getIncusInstance,
	deleteIncusInstance,
	SAFE_NAME_RE,
} from "@/lib/db/incus-instances";

interface RouteContext {
	params: Promise<{ name: string }>;
}

async function liveStatus(name: string): Promise<string | null> {
	try {
		const { stdout } = await hostExecFile("incus", ["list", name, "--format", "json"], {
			timeout: 10000,
		});
		const arr = JSON.parse(stdout) as Array<{ status?: string }>;
		return arr[0]?.status ?? null;
	} catch {
		return null;
	}
}

export async function GET(request: Request, context: RouteContext) {
	const auth = await requireAdmin(request, { tool: "incus.instances.get" });
	if (auth.error) return auth.error;
	const { name } = await context.params;
	if (!SAFE_NAME_RE.test(name)) {
		return NextResponse.json({ error: "Invalid name" }, { status: 400 });
	}
	const row = await getIncusInstance(name);
	if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
	const live = await liveStatus(name);
	return NextResponse.json({ data: { ...row, live_status: live } });
}

export async function DELETE(request: Request, context: RouteContext) {
	const auth = await requireAdmin(request, { tool: "incus.instances.delete" });
	if (auth.error) return auth.error;
	const { name } = await context.params;
	if (!SAFE_NAME_RE.test(name)) {
		return NextResponse.json({ error: "Invalid name" }, { status: 400 });
	}
	await deleteIncusInstance(name);
	return NextResponse.json({ success: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
