import { NextResponse } from "next/server";
import { scanAgents } from "@/lib/agents/scanner";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { slug } = await params;
    const groups = await scanAgents();

    for (const group of groups) {
      const agent = group.agents.find((a) => a.slug === slug);
      if (agent) {
        return NextResponse.json({
          files: agent.files,
          agent: {
            slug: agent.slug,
            name: agent.name,
            emoji: agent.emoji,
            model: agent.model,
            project: group.project,
          },
        });
      }
    }

    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list files";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
