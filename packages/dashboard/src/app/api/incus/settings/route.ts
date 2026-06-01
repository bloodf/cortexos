/**
 * /api/incus/settings — global wizard defaults + AI model (admin only).
 * Backed by the `config` key/value table.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getConfigValue, setConfigValue } from "@/lib/db/config-kv";

const DEFAULTS_KEY = "incus.wizard.defaults";
const MODEL_KEY = "incus.ai.model";

const FALLBACK_DEFAULTS = {
	image: "cortexos-base/latest",
	ghOrg: "bloodf",
	bridge: "incusbr0",
	pool: "cortex-zfs",
	branch: "main",
	proxies: ["9router", "honcho", "ollama"],
};

export async function GET(request: Request) {
	const auth = await requireAdmin(request, { tool: "incus.settings.get" });
	if (auth.error) return auth.error;
	const defaults = await getConfigValue(DEFAULTS_KEY, FALLBACK_DEFAULTS);
	const model = await getConfigValue(MODEL_KEY, "");
	return NextResponse.json({ data: { defaults, model } });
}

export async function PUT(request: Request) {
	const auth = await requireAdmin(request, { tool: "incus.settings.set" });
	if (auth.error) return auth.error;
	let body: { defaults?: unknown; model?: unknown };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid body" }, { status: 400 });
	}
	if (body.defaults !== undefined) await setConfigValue(DEFAULTS_KEY, body.defaults);
	if (body.model !== undefined) await setConfigValue(MODEL_KEY, String(body.model));
	return NextResponse.json({ success: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
