import { NextResponse } from "next/server";
import { hostExecFile } from "@/lib/host-exec";
import { requireAuth } from "@/lib/auth";

interface SystemdService {
  name: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

function parseListUnits(stdout: string): SystemdService[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, load, active, sub, ...descriptionParts] = line.split(/\s+/);
      return {
        name,
        load,
        active,
        sub,
        description: descriptionParts.join(" "),
      };
    })
    .filter((service) => service.name?.endsWith(".service"));
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { stdout } = await hostExecFile(
      "systemctl",
      ["list-units", "--type=service", "--all", "--no-legend", "--no-pager"],
      { timeout: 10000, maxBuffer: 5 * 1024 * 1024 },
    );
    return NextResponse.json({ services: parseListUnits(stdout) });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Failed to list systemd services";
    return NextResponse.json({ error }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
