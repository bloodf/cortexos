/**
 * /api/incus/instances/[name]/validate — deterministic pre-flight validation.
 *
 * The deterministic `runPreflight` result is authoritative; on pass the saved
 * config advances to status `validated`. (AI advice, when wired in v1.1, is
 * additive only and never changes this gate.)
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
	getIncusInstance,
	updateIncusInstanceStatus,
	setLastValidation,
	SAFE_NAME_RE,
} from "@/lib/db/incus-instances";
import { runPreflight } from "@/lib/incus/preflight";
import type { IncusInstanceConfig } from "@/lib/incus/instance-config";
import { aiPreflightAdvice } from "@/lib/ai/incus-analysis";

interface RouteContext {
	params: Promise<{ name: string }>;
}

export async function POST(request: Request, context: RouteContext) {
	const auth = await requireAdmin(request, { tool: "incus.instances.validate" });
	if (auth.error) return auth.error;
	const { name } = await context.params;
	if (!SAFE_NAME_RE.test(name)) {
		return NextResponse.json({ error: "Invalid name" }, { status: 400 });
	}

	const row = await getIncusInstance(name);
	if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const cfg = row.config as unknown as IncusInstanceConfig;
	const report = await runPreflight(cfg);

	// Deterministic result is authoritative for the status gate. AI advice is
	// additive and never blocks (null when provider is unavailable).
	const advice = await aiPreflightAdvice(cfg, report).catch(() => null);

	await setLastValidation(name, {
		phase: "preflight",
		ok: report.ok,
		checks: report.checks,
		advice,
		at: new Date().toISOString(),
	});
	if (report.ok) {
		await updateIncusInstanceStatus(name, "validated");
	}

	return NextResponse.json({ data: { preflight: report, advice } });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
