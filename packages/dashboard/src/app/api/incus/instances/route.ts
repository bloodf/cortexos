/**
 * /api/incus/instances — saved wizard configs (GET list, POST create draft).
 * Admin-gated. Live container status is read separately via /api/incus.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
	listIncusInstances,
	createIncusInstance,
	getIncusInstance,
} from "@/lib/db/incus-instances";
import {
	validateConfigShape,
	redactConfig,
	type IncusInstanceConfig,
} from "@/lib/incus/instance-config";
import { incusInstanceConfigSchema } from "@/lib/incus/config-schema";

export async function GET(request: Request) {
	const auth = await requireAdmin(request, { tool: "incus.instances.list" });
	if (auth.error) return auth.error;
	const rows = await listIncusInstances();
	return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "incus.instances.create" });
	if (auth.error) return auth.error;

	let cfg: IncusInstanceConfig;
	try {
		const raw = await request.json();
		cfg = incusInstanceConfigSchema.parse(raw.config ?? raw) as IncusInstanceConfig;
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Invalid config";
		return NextResponse.json({ error: msg }, { status: 400 });
	}

	const shape = validateConfigShape(cfg);
	if (!shape.ok) {
		return NextResponse.json({ error: "Invalid config", details: shape.errors }, { status: 400 });
	}

	const existing = await getIncusInstance(cfg.target.slug).catch(() => null);
	if (existing) {
		return NextResponse.json({ error: `Config already exists: ${cfg.target.slug}` }, { status: 409 });
	}

	const row = await createIncusInstance({
		name: cfg.target.slug,
		slug: cfg.target.slug,
		config: redactConfig(cfg) as unknown as Record<string, unknown>,
		created_by: auth.session?.username ?? null,
		status: "draft",
	});
	return NextResponse.json({ data: row }, { status: 201 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
