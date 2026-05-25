import { NextResponse } from "next/server";
import { scanAgents, readAgentFile, writeAgentFile } from "@/lib/agents/scanner";
import { requireAuth, requireAdmin } from "@/lib/auth";

async function findAgentFilePath(
  slug: string,
  fileId: string,
): Promise<string | null> {
  const groups = await scanAgents();
  for (const group of groups) {
    const agent = group.agents.find((a) => a.slug === slug);
    if (agent) {
      const file = agent.files.find((f) => f.id === fileId || f.name === fileId);
      return file?.path ?? null;
    }
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; filename: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { slug, filename } = await params;
    const filePath = await findAgentFilePath(slug, filename);

    if (!filePath) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const content = await readAgentFile(filePath);
    return NextResponse.json({ content, fileId: filename });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string; filename: string }> },
) {
  const auth = await requireAdmin(request, { tool: "agent.file.write" });
  if (auth.error) return auth.error;

  try {
    const { slug, filename } = await params;
    const filePath = await findAgentFilePath(slug, filename);

    if (!filePath) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const body = await request.json();
    if (typeof body.content !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'content' field" },
        { status: 400 },
      );
    }

    await writeAgentFile(filePath, body.content);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to write file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
