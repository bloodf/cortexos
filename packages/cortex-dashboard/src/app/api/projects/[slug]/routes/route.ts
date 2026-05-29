import { NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { getProject } from "@/lib/db/projects";
import { listRoutes, addRoute, removeRoute } from "@/lib/db/messaging-routes";
import type { MessagingPlatform } from "@/lib/db/messaging-routes";
import { insertAuditRow } from "@/lib/db/dashboard-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLATFORMS: ReadonlySet<string> = new Set([
	"telegram", "slack", "discord", "whatsapp", "signal", "sms",
	"email", "matrix", "mattermost", "teams", "line", "viber", "wechat", "webhook",
]);

function auditMutation(tool: string, actorUserId: number | null, argsHash: string) {
	return insertAuditRow({
		actor_user_id: actorUserId,
		tool,
		tool_class: "safe",
		args_hash: argsHash,
		decision: "allow",
		result: "ok",
	}).catch(() => {});
}

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, ctx: RouteContext) {
	const auth = await requireAuth(request);
	if (auth.error) return auth.error;

	const { slug } = await ctx.params;

	try {
		const project = await getProject(slug);
		if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

		const routes = await listRoutes(project.id);
		return NextResponse.json({ routes });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Internal server error";
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}

export async function POST(request: Request, ctx: RouteContext) {
	const auth = await requireAdmin(request, { tool: "messaging_route.add" });
	if (auth.error) return auth.error;

	const { slug } = await ctx.params;

	try {
		const project = await getProject(slug);
		if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

		const body = await request.json();
		const platform = String(body.platform ?? "").trim();
		const account_ref = String(body.account_ref ?? "").trim();

		if (!platform || !PLATFORMS.has(platform)) {
			return NextResponse.json(
				{ error: `platform must be one of: ${[...PLATFORMS].join(", ")}`, code: "EVALIDATION" },
				{ status: 400 },
			);
		}
		if (!account_ref) {
			return NextResponse.json(
				{ error: "account_ref is required", code: "EVALIDATION" },
				{ status: 400 },
			);
		}

		const route = await addRoute({
			project_id: project.id,
			platform: platform as MessagingPlatform,
			account_ref,
			route_config: body.route_config ?? {},
			approval_gates: body.approval_gates ?? [],
		});

		await auditMutation(
			"messaging_route.add",
			auth.session?.user_id ?? null,
			`${slug}|${platform}|${account_ref}`,
		);

		return NextResponse.json({ route }, { status: 201 });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Internal server error";
		const status = msg.includes("Invalid") ? 400 : 500;
		return NextResponse.json({ error: msg }, { status });
	}
}

export async function DELETE(request: Request, ctx: RouteContext) {
	const auth = await requireAdmin(request, { tool: "messaging_route.remove" });
	if (auth.error) return auth.error;

	const { slug } = await ctx.params;
	const { searchParams } = new URL(request.url);
	const idStr = searchParams.get("id") ?? "";
	const id = parseInt(idStr, 10);

	if (!idStr || !Number.isInteger(id) || id <= 0) {
		return NextResponse.json(
			{ error: "id query param required (positive integer)", code: "EVALIDATION" },
			{ status: 400 },
		);
	}

	try {
		await removeRoute(id);
		await auditMutation(
			"messaging_route.remove",
			auth.session?.user_id ?? null,
			`${slug}|${id}`,
		);
		return NextResponse.json({ success: true });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Internal server error";
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}
