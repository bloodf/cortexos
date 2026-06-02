import { NextResponse } from "next/server";
import { hostExecFile } from "@/lib/host-exec";
import { requireAuth } from "@/lib/auth";

interface ScheduledJob {
  id: string;
  name: string;
  schedule: string;
  next_run: string;
  enabled: boolean;
}

interface SystemdTimer {
  unit: string;
  next: number | null;
  left: string;
  last: string;
  passed: string;
  activates: string;
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { stdout } = await hostExecFile(
      "systemctl",
      ["list-timers", "--all", "--output=json"],
      { timeout: 10000, maxBuffer: 5 * 1024 * 1024 },
    );

    let timers: SystemdTimer[] = [];
    try {
      timers = JSON.parse(stdout);
    } catch {
      // systemctl list-timers --output=json not supported; return empty list
      return NextResponse.json({ jobs: [] });
    }

    const jobs: ScheduledJob[] = timers.map((t) => ({
      id: t.unit,
      name: t.unit.replace(/\.timer$/, ""),
      schedule: t.activates || t.left,
      next_run: typeof t.next === "number" ? new Date(t.next / 1000).toISOString() : "",
      enabled: t.next != null,
    }));

    return NextResponse.json({ jobs });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Failed to list systemd timers";
    return NextResponse.json({ error }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
