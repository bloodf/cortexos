import { NextResponse } from "next/server";
import { scanAgents } from "@/lib/agents/scanner";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const groups = await scanAgents();
    return NextResponse.json({ groups, timestamp: Date.now() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to scan agents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
