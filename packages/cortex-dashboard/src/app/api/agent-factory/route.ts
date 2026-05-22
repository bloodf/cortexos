import { promises as fs } from "node:fs";
import path from "node:path";
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

const TEMPLATE_DIR = path.resolve(process.cwd(), "../../templates/agent-factory");
const ROLES_DIR = path.resolve(process.cwd(), "../../templates/agent-roles");
const MD_FILE_RE = /^[A-Z0-9_.-]+\.md$/i;

function markdownPath(fileParam: string | null, baseDir = TEMPLATE_DIR): string | null {
	const file = (fileParam ?? "").trim();
	if (!MD_FILE_RE.test(file)) return null;
	const resolved = path.resolve(baseDir, file);
	return resolved.startsWith(`${baseDir}${path.sep}`) ? resolved : null;
}

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
	const markdownFile = markdownPath(searchParams.get("markdown"));

	if (markdownFile) {
		try {
			const content = await fs.readFile(markdownFile, "utf8");
			return NextResponse.json({ file: path.basename(markdownFile), content });
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				const roleMarkdownFile = markdownPath(searchParams.get("markdown"), ROLES_DIR);
				if (roleMarkdownFile) {
					try {
						const content = await fs.readFile(roleMarkdownFile, "utf8");
						return NextResponse.json({ file: path.basename(roleMarkdownFile), content });
					} catch (roleErr) {
						if ((roleErr as NodeJS.ErrnoException).code !== "ENOENT") return NextResponse.json({ error: "Internal server error" }, { status: 500 });
					}
				}
				return NextResponse.json({ error: "Markdown file not found", code: "ENOTFOUND" }, { status: 404 });
			}
			return NextResponse.json({ error: "Internal server error" }, { status: 500 });
		}
	}

	if (searchParams.has("markdown")) {
		return NextResponse.json({ error: "Invalid markdown file", code: "EVALIDATION" }, { status: 400 });
	}

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
		const markdownFile = markdownPath(typeof body.markdownFile === "string" ? body.markdownFile : null);

		if (body.markdownContent !== undefined) {
			if (!markdownFile || typeof body.markdownContent !== "string") {
				return NextResponse.json({ error: "Valid markdownFile and markdownContent required", code: "EVALIDATION" }, { status: 400 });
			}
			await fs.writeFile(markdownFile, body.markdownContent, "utf8");
			await auditMutation("agent_factory.markdown_write", auth.session?.user_id ?? null, path.basename(markdownFile));
			return NextResponse.json({ file: path.basename(markdownFile), success: true });
		}

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
