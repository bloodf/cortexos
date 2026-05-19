import { NextResponse } from "next/server";
import { scanAgents } from "@/lib/agents/scanner";

export async function GET() {
  try {
    const groups = await scanAgents();
    return NextResponse.json({ groups, timestamp: Date.now() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to scan agents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
