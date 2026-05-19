import { NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { acknowledgeAlert, deleteAlert, listAlerts } from "@/lib/db/alerts";
import type { AlertSeverity } from "@/lib/db/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEVERITIES = new Set<AlertSeverity>(["info", "warn", "error", "critical"]);

export async function GET(request: Request) {
	const auth = await requireAuth(request);
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const severity = searchParams.get("severity") ?? undefined;
	const unacknowledged = searchParams.get("unacknowledged") === "1";
	const limit = parseInt(searchParams.get("limit") ?? "100", 10);

	if (severity && !SEVERITIES.has(severity as AlertSeverity)) {
		return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
	}

	const alerts = await listAlerts({
		severity: severity as AlertSeverity | undefined,
		unacknowledged,
		limit: Number.isNaN(limit) ? 100 : limit,
	});
	return NextResponse.json({ alerts });
}

export async function PATCH(request: Request) {
	const auth = await requireAdmin(request, { tool: "alert.acknowledge" });
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const id = parseInt(searchParams.get("id") ?? "", 10);
	if (!Number.isInteger(id) || id < 1) {
		return NextResponse.json({ error: "Invalid id" }, { status: 400 });
	}

	const alert = await acknowledgeAlert(id);
	if (!alert) {
		return NextResponse.json(
			{ error: "Alert not found or already acknowledged" },
			{ status: 404 },
		);
	}
	return NextResponse.json({ alert });
}

export async function DELETE(request: Request) {
	const auth = await requireAdmin(request, { tool: "alert.delete" });
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const id = parseInt(searchParams.get("id") ?? "", 10);
	if (!Number.isInteger(id) || id < 1) {
		return NextResponse.json({ error: "Invalid id" }, { status: 400 });
	}
	await deleteAlert(id);
	return NextResponse.json({ success: true });
}
