// @vitest-environment node
import { NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth";
import {
	listProjects,
	createProject,
	updateProject,
	deleteProject,
} from "@/lib/db/projects";
import { insertAuditRow } from "@/lib/db/agent-gateway-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function auditMutation(
	tool: string,
	actorUserId: number | null,
	argsHash: string,
) {
	return insertAuditRow({
		actor_user_id: actorUserId,
		tool,
		tool_class: "safe",
		args_hash: argsHash,
		decision: "allow",
		result: "ok",
	}).catch(() => {
		/* audit failures must not block the response */
	});
}

export async function GET(request: Request) {
	const auth = await requireAuth(request);
	if (auth.error) return auth.error;

	try {
		const projects = await listProjects();
		return NextResponse.json({ projects });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Internal server error";
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "project.upsert" });
	if (auth.error) return auth.error;

	try {
		const body = await request.json();
		const slug = String(body.slug ?? "").trim();
		const name = String(body.name ?? "").trim();

		if (!slug || !name) {
			return NextResponse.json(
				{ error: "slug and name are required", code: "EVALIDATION" },
				{ status: 400 },
			);
		}

		const project = await createProject({
			slug,
			name,
			repo_url: body.repo_url ?? null,
			primary_pm_account: body.primary_pm_account ?? null,
			messaging_mode: body.messaging_mode,
			settings: {},
		});

		await auditMutation("project.upsert", auth.session?.user_id ?? null, slug);

		return NextResponse.json({ project }, { status: 201 });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Internal server error";
		const status = msg.includes("Invalid") ? 400 : 500;
		return NextResponse.json({ error: msg }, { status });
	}
}

export async function PUT(request: Request) {
	const auth = await requireAdmin(request, { tool: "project.upsert" });
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const slug = searchParams.get("slug") ?? "";

	if (!slug) {
		return NextResponse.json(
			{ error: "slug query param required", code: "EVALIDATION" },
			{ status: 400 },
		);
	}

	try {
		const body = await request.json();
		const patch = {
			name: body.name,
			repo_url: body.repo_url,
			primary_pm_account: body.primary_pm_account,
			messaging_mode: body.messaging_mode,
			settings: body.settings,
		};

		const project = await updateProject(slug, patch);

		await auditMutation(
			"project.upsert",
			auth.session?.user_id ?? null,
			slug,
		);

		return NextResponse.json({ project });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Internal server error";
		if (msg.includes("not found")) return NextResponse.json({ error: msg }, { status: 404 });
		const status = msg.includes("Invalid") || msg.includes("No valid") ? 400 : 500;
		return NextResponse.json({ error: msg }, { status });
	}
}

export async function DELETE(request: Request) {
	const auth = await requireAdmin(request, { tool: "project.delete" });
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const slug = searchParams.get("slug") ?? "";

	if (!slug) {
		return NextResponse.json(
			{ error: "slug query param required", code: "EVALIDATION" },
			{ status: 400 },
		);
	}

	try {
		await deleteProject(slug);
		await auditMutation(
			"project.delete",
			auth.session?.user_id ?? null,
			slug,
		);
		return NextResponse.json({ success: true });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Internal server error";
		const status = msg.includes("Invalid") ? 400 : 500;
		return NextResponse.json({ error: msg }, { status });
	}
}
