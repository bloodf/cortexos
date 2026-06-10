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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hashId(uuid: string): number {
  return parseInt(uuid.replace(/-/g, "").slice(0, 8), 16) >>> 0;
}
