import { NextResponse } from "next/server";
import { isIP } from "net";
import { requireAdmin } from "@/lib/auth";
import { executeRootCommand } from "@/lib/root-helper/executor";

function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map((item) => String(item));
}

function requestIp(request: Request): string | null {
	const forwarded = request.headers.get("x-forwarded-for");
	const candidate = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
	return candidate && isIP(candidate) ? candidate : null;
}

function stringEnv(value: unknown): Record<string, string> | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>).map(([key, item]) => [
			key,
			String(item),
		]),
	);
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "root-helper.command" });
	if (auth.error) return auth.error;

	try {
		const body = await request.json();
		const command = String(body.command || "").trim();
		if (!command) {
			return NextResponse.json({ error: "command is required" }, { status: 400 });
		}
		const result = await executeRootCommand({
			command,
			argv: stringArray(body.argv),
			cwd: body.cwd ? String(body.cwd) : "/",
			stdin: body.stdin ? String(body.stdin) : "",
			env: stringEnv(body.env),
			timeoutMs: Number(body.timeoutMs || 30000),
			dryRun: Boolean(body.dryRun),
			requestedBy: auth.session?.username ?? "trusted-dashboard",
			sourceIp: requestIp(request),
			sourceUserAgent: request.headers.get("user-agent"),
			dashboardSessionId: auth.session ? `user-${auth.session.user_id}` : null,
			mutationClass: body.mutationClass ? String(body.mutationClass) : "manual-command",
			targetScope: body.targetScope ? String(body.targetScope) : "host",
			metadata: { route: "/api/root-helper/commands" },
		});
		return NextResponse.json({ success: true, ...result });
	} catch (error) {
		const message = error instanceof Error ? error.message : "root helper command failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
