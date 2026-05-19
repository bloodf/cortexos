import { NextResponse } from "next/server";
import { hostExecFile } from "@/lib/host-exec";
import { requireAuth } from "@/lib/auth";

interface SystemdService {
  name: string;
  load: string;
  active: string;
  sub: string;
  description: string;
  enabled: string;
}

function parseListUnits(stdout: string, unitFiles: Map<string, string>): SystemdService[] {
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
        enabled: unitFiles.get(name) ?? "unknown",
        description: descriptionParts.join(" "),
      };
    })
    .filter((service) => service.name?.endsWith(".service"));
}

function parseListUnitFiles(stdout: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [name, state] = trimmed.split(/\s+/);
    if (name?.endsWith(".service") && state) map.set(name, state);
  }
  return map;
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const [units, files] = await Promise.all([
      hostExecFile(
        "systemctl",
        ["list-units", "--type=service", "--all", "--no-legend", "--no-pager"],
        { timeout: 10000, maxBuffer: 5 * 1024 * 1024 },
      ),
      hostExecFile(
        "systemctl",
        ["list-unit-files", "--type=service", "--no-legend", "--no-pager"],
        { timeout: 10000, maxBuffer: 5 * 1024 * 1024 },
      ),
    ]);
    return NextResponse.json({ services: parseListUnits(units.stdout, parseListUnitFiles(files.stdout)) });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Failed to list systemd services";
    return NextResponse.json({ error }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
