/**
 * Adapter: @cortexos/contracts Service → sys-pilot mock row shape.
 *
 * The contract's `Service` uses camelCase and UUIDs. sys-pilot's components
 * expect the shape defined in `src/mocks/types.ts` (snake_case, numeric id,
 * etc.). This module maps one to the other without touching component props.
 *
 * Functions are pure — no side-effects, no API calls.
 */
import type {
  Service as ContractService,
  BadgeRef as ContractBadgeRef,
  ServiceHealthSnapshot as ContractHealthSnapshot,
} from "@cortexos/contracts/entities";

import type {
  Service as MockService,
  ServiceCheck as MockServiceCheck,
  BadgeRef as MockBadgeRef,
} from "@/mocks/types";

// ---------------------------------------------------------------------------
// Badge ref
// ---------------------------------------------------------------------------

export function toBadgeRef(b: ContractBadgeRef): MockBadgeRef {
  return {
    slug: b.slug,
    label: b.label,
    color: b.color ?? "#64748b",
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type MockStatus = MockService["status"];

function mapServiceStatus(status: ContractService["status"]): MockStatus {
  switch (status) {
    case "online":
      return "online";
    case "offline":
      return "offline";
    case "checking": // mock has no "checking" — treat as unknown while probe runs
    case "degraded":
    case "unknown":
    default:
      return "unknown";
  }
}

/**
 * Convert a service id to the stable integer id sys-pilot numeric `id` fields
 * expect. The services table uses an integer serial id (so the value arrives as
 * a number); older/contract data may use a UUID string. Handle both: a number
 * passes through, a UUID is reduced to its first 8 hex chars as a base-16 int.
 * Guarding the string case is what keeps a real integer id from throwing
 * `id.replace is not a function`, which would reject the whole row map and blank
 * every services view (Apps, Overview, admin/Services).
 */
function hashId(id: string | number): number {
  if (typeof id === "number") return Number.isFinite(id) ? id : 0;
  const n = parseInt(String(id).replace(/-/g, "").slice(0, 8), 16);
  return Number.isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Service (full row used by Apps / Healthcheck pages)
// ---------------------------------------------------------------------------

/**
 * Map a contract Service entity to the mock Service shape consumed by
 * sys-pilot components. Fields without a direct counterpart are given
 * safe defaults so components never receive `undefined` where they expect
 * a value.
 */
export function toServiceRow(s: ContractService): MockService {
  return {
    // ServiceCheck fields
    id: hashId(s.id),
    slug: s.slug,
    name: s.name,
    open_url: s.openUrl ?? `/${s.slug}`,
    category: s.category,
    status: mapServiceStatus(s.status),
    responseTime: s.responseMs ?? 0,
    icon_color: s.icon?.color ?? null,
    icon_image: s.icon?.image ?? null,

    // Service-specific fields
    kind: s.kind as MockService["kind"],
    health_url: s.healthUrl,
    health_type: s.healthType as MockService["health_type"],
    description: s.description ?? null,
    env_source: s.envSource ?? null,
    is_active: s.isActive,
    has_webui: s.hasWebui,
    show_in_healthcheck: s.showInHealthcheck,
    show_in_webui: s.showInWebui,
    sort_order: s.sortOrder,
    icon_type: s.icon?.type ?? "auto",
    badges: (s.badges ?? []).map(toBadgeRef),
  };
}

/** Map a contract Service to the leaner ServiceCheck shape. */
export function toServiceCheckRow(s: ContractService): MockServiceCheck {
  return {
    id: hashId(s.id),
    slug: s.slug,
    name: s.name,
    open_url: s.openUrl ?? `/${s.slug}`,
    category: s.category,
    status: mapServiceStatus(s.status),
    responseTime: s.responseMs ?? 0,
    icon_color: s.icon?.color ?? null,
    icon_image: s.icon?.image ?? null,
  };
}

// ---------------------------------------------------------------------------
// Health snapshot (history page)
// ---------------------------------------------------------------------------

export interface HealthSnapshotRow {
  id: string;
  serviceId: string;
  status: MockService["status"];
  latencyMs: number | null;
  checkedAt: string;
  note: string | null;
}

export function toHealthSnapshotRow(snap: ContractHealthSnapshot): HealthSnapshotRow {
  return {
    id: snap.id,
    serviceId: snap.serviceId,
    status: mapServiceStatus(snap.status),
    latencyMs: snap.latencyMs,
    checkedAt: snap.checkedAt,
    note: snap.note ?? null,
  };
}
