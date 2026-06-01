/**
 * /api/incus/ai/analyze — touchpoint 1: analyze a target repo / new-project
 * description and return recommended wizard settings. Admin-gated. Returns
 * `{ analysis: null }` (200) when the provider is unconfigured/down so the
 * wizard degrades gracefully rather than erroring.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { hostExecFile } from "@/lib/host-exec";
import { analyzeTarget } from "@/lib/ai/incus-analysis";

const bodySchema = z.object({
	mode: z.enum(["existing", "new"]),
	repoUrl: z.string().max(512).optional(),
	branch: z.string().max(128).optional(),
	description: z.string().max(4000).optional(),
});

const REPO_URL_RE = /^(https:\/\/[^\s]+|git@[^\s:]+:[^\s]+)$/;

/** Best-effort read-only signal: remote branch/tag refs. Never throws. */
async function gatherSignals(repoUrl?: string): Promise<string | undefined> {
	if (!repoUrl || !REPO_URL_RE.test(repoUrl)) return undefined;
	try {
		const { stdout } = await hostExecFile("git", ["ls-remote", "--heads", "--tags", repoUrl], {
			timeout: 10000,
		});
		return stdout.split("\n").slice(0, 40).join("\n");
	} catch {
		return undefined;
	}
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "incus.ai.analyze" });
	if (auth.error) return auth.error;

	let body: z.infer<typeof bodySchema>;
	try {
		body = bodySchema.parse(await request.json());
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Invalid body";
		return NextResponse.json({ error: msg }, { status: 400 });
	}

	if (!process.env.NINEROUTER_BASE_URL || !process.env.NINEROUTER_API_KEY) {
		return NextResponse.json({ analysis: null, note: "provider not configured" });
	}

	const signals = await gatherSignals(body.repoUrl);
	const analysis = await analyzeTarget({ ...body, signals });
	return NextResponse.json({ analysis });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
