import { NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth";
import {
	listAgentFactories,
	upsertAgentFactory,
	deleteAgentFactory,
} from "@/lib/db/agent-factories";
import type { AgentFactoryKind } from "@/lib/db/agent-factories";
import { insertAuditRow } from "@/lib/db/tool-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
	const auth = await requireAuth(request);
	if (auth.error) return auth.error;

	const { searchParams } = new URL(request.url);
	const kind = searchParams.get("kind") ?? undefined;

	try {
		const factories = await listAgentFactories(
			kind ? { kind: kind as AgentFactoryKind } : {},
		);
		return NextResponse.json({ factories });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Internal server error";
		const status = msg.includes("Invalid") ? 400 : 500;
		return NextResponse.json({ error: msg }, { status });
	}
}

export async function POST(request: Request) {
	const auth = await requireAdmin(request, { tool: "agent_factory.upsert" });
	if (auth.error) return auth.error;

	try {
		const body = await request.json();
		const slug = String(body.slug ?? "").trim();
		const name = String(body.name ?? "").trim();
		const kind = String(body.kind ?? "").trim();

		if (!slug || !name || !kind) {
			return NextResponse.json(
				{ error: "slug, name, and kind are required", code: "EVALIDATION" },
				{ status: 400 },
			);
		}

		const factory = await upsertAgentFactory({
			slug,
			name,
			kind: kind as AgentFactoryKind,
			schema_version: typeof body.schema_version === "number" ? body.schema_version : 1,
			definition: body.definition ?? {},
			created_by: auth.session?.username ?? null,
		});

		await auditMutation(
			"agent_factory.upsert",
			auth.session?.user_id ?? null,
			slug,
		);

		return NextResponse.json({ factory }, { status: 201 });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Internal server error";
		const status = msg.includes("Invalid") ? 400 : 500;
		return NextResponse.json({ error: msg }, { status });
	}
}

export async function PUT(request: Request) {
	const auth = await requireAdmin(request, { tool: "agent_factory.upsert" });
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

		const factory = await upsertAgentFactory({
			slug,
			name: String(body.name ?? "").trim() || slug,
			kind: (body.kind ?? "role") as AgentFactoryKind,
			schema_version: typeof body.schema_version === "number" ? body.schema_version : undefined,
			definition: body.definition,
			created_by: auth.session?.username ?? null,
		});

		await auditMutation(
			"agent_factory.upsert",
			auth.session?.user_id ?? null,
			slug,
		);

		return NextResponse.json({ factory });
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Internal server error";
		const status = msg.includes("Invalid") ? 400 : 500;
		return NextResponse.json({ error: msg }, { status });
	}
}

export async function DELETE(request: Request) {
	const auth = await requireAdmin(request, { tool: "agent_factory.delete" });
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
		await deleteAgentFactory(slug);
		await auditMutation(
			"agent_factory.delete",
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
