/**
 * Adapter: @cortexos/contracts IncusLiveInstance → sys-pilot IncusInstance mock shape.
 *
 * The contract's `IncusLiveInstance` comes from `incus list` JSON output.
 * sys-pilot's components expect the `IncusInstance` shape from mocks/types.ts
 * which includes project metadata and a flat status string.
 *
 * Functions are pure — no side-effects, no API calls.
 */
import type { IncusLiveInstance as ContractLiveInstance } from "@cortexos/contracts/entities";
import type { IncusInstance as MockIncusInstance } from "@/mocks/types";

// ---------------------------------------------------------------------------
// Live instance → mock IncusInstance
// ---------------------------------------------------------------------------

/**
 * Map a live `IncusLiveInstance` (from `GET /api/incus/instances`) to the
 * `IncusInstance` shape sys-pilot components consume.
 *
 * Fields with no live counterpart (project metadata, last_validation, etc.)
 * are given empty/null defaults — callers should not fabricate data.
 */
export function toIncusInstanceRow(inst: ContractLiveInstance): MockIncusInstance {
  // Extract first global IPv4 for display purposes (best-effort).
  const ipv4 = extractIpv4(inst);

  return {
    name: inst.name,
    slug: slugify(inst.name),
    status: mapIncusStatus(inst.statusCode ?? inst.status),
    type: inst.type,
    image: inst.architecture ?? "unknown",
    cpu: 0, // not available from live list; WP-12 bridge may enrich
    memory: 0, // same
    config: {}, // not in live list shape
    devices: {}, // not in live list shape
    last_validation: null,
    created_at: inst.createdAt,
    project: {
      name: inst.name, // incus name is the project identifier
      description: "",
      repo_url: "",
      branch: "main",
    },
    // Attach IP as a non-standard field for downstream use (does not conflict
    // with the mock shape which has no ip field).
    ...(ipv4 ? { _ip: ipv4 } : {}),
  } as MockIncusInstance;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type MockStatus = MockIncusInstance["status"];

function mapIncusStatus(raw: string): MockStatus {
  const s = raw.toLowerCase();
  if (s === "running" || s === "active") return "active";
  if (s === "stopped" || s === "inactive") return "failed";
  if (s === "frozen") return "validated";
  if (s === "draft") return "draft";
  if (s === "provisioning") return "provisioning";
  if (s === "validated") return "validated";
  if (s === "failed" || s === "error") return "failed";
  return "failed";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractIpv4(inst: ContractLiveInstance): string | null {
  for (const iface of Object.values(inst.state?.networks ?? {})) {
    for (const addr of iface.addresses ?? []) {
      if (addr.family === "inet" && addr.scope === "global") {
        return addr.address;
      }
    }
  }
  return null;
}
