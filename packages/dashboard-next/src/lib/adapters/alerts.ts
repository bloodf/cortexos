/**
 * Adapter: @cortexos/contracts AlertRule / AlertEvent → sys-pilot mock shapes.
 *
 * Functions are pure — no side-effects, no API calls.
 */
import type {
  AlertRule as ContractAlertRule,
  AlertEvent as ContractAlertEvent,
} from "@cortexos/contracts/entities";
import type { AlertRule as MockAlertRule, AlertHistory as MockAlertHistory } from "@/mocks/types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Handle both an integer serial id (the real DB shape — passes through) and a
// UUID string. Guarding the string case stops a real integer id from throwing
// `id.replace is not a function`, which would blank the alerts views.
function hashId(id: string | number): number {
  if (typeof id === "number") return Number.isFinite(id) ? id : 0;
  const n = parseInt(String(id).replace(/-/g, "").slice(0, 8), 16);
  return Number.isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// AlertRule
// ---------------------------------------------------------------------------

/**
 * Map a contract AlertRule to the mock AlertRule shape.
 *
 * `service_id` is a numeric id in the mock but a UUID in the contract.
 * We use the same UUID-to-int hash used in the services adapter.
 */
export function toAlertRuleRow(r: ContractAlertRule): MockAlertRule {
  return {
    id: r.id,
    name: r.name,
    service_id: r.serviceId ? hashId(r.serviceId) : 0,
    condition: r.condition,
    threshold_ms: r.thresholdMs ?? null,
    enabled: r.enabled,
  };
}

// ---------------------------------------------------------------------------
// AlertEvent (history)
// ---------------------------------------------------------------------------

/**
 * Map a contract AlertEvent to the mock AlertHistory shape.
 */
export function toAlertHistoryRow(e: ContractAlertEvent): MockAlertHistory {
  return {
    id: e.id,
    ruleName: e.ruleName ?? "",
    serviceName: e.serviceName ?? "",
    status: e.status,
    message: e.message,
    timestamp: e.firedAt,
  };
}
