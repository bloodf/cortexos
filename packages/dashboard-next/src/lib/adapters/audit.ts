/**
 * Adapter: @cortexos/contracts AuditEvent → sys-pilot AuditEntry mock shape.
 *
 * Functions are pure — no side-effects, no API calls.
 */
import type { AuditEntry as MockAuditEntry } from "@/mocks/types";

/**
 * The contract audit event shape from GET /api/audit.
 * Defined inline to avoid importing the full contracts barrel (tree-shaking).
 */
export interface ContractAuditEvent {
  id: string;
  /** Username or agent slug (e.g. "user:alex", "agent:obot"). */
  actor: string;
  surface: string;
  action: string;
  result: "allow" | "deny" | "ok" | "error" | string;
  target: string | null;
  detail: string | null;
  createdAt: string;
  /** HMAC chain hash (opaque to UI). */
  chainHash?: string;
}

function mapDecision(result: string): "allow" | "deny" {
  if (result === "deny" || result === "error") return "deny";
  return "allow";
}

/**
 * Map a contract AuditEvent to the mock AuditEntry shape that sys-pilot
 * components consume.
 *
 * The mock shape uses `tool` and `tool_class` where the contract uses
 * `action` and `surface`. We map directly so the component sees the same
 * field names.
 */
export function toAuditEntryRow(e: ContractAuditEvent): MockAuditEntry {
  return {
    id: e.id,
    actor: e.actor,
    tool: e.action,
    tool_class: e.surface,
    args_hash: e.chainHash ?? "",
    decision: mapDecision(e.result),
    decision_reason: e.detail ?? e.result,
    result: e.result,
    created_at: e.createdAt,
  };
}
