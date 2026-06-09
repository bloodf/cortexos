/**
 * Adapter: @cortexos/contracts ApprovalRequest → sys-pilot ApprovalRequest mock shape.
 *
 * Functions are pure — no side-effects, no API calls.
 */
import type { ApprovalRequest as MockApprovalRequest } from "@/mocks/types";

/**
 * Contract shape from GET /api/approvals.
 * Defined inline to keep this file self-contained.
 */
export interface ContractApprovalRequest {
  id: string;
  actorId: string;
  actorUsername: string;
  surface: string;
  tool: string;
  summary: string;
  argsPreview: Record<string, unknown>;
  actionHash: string;
  class: string;
  requestedAt: string;
  status: "pending" | "approved" | "denied" | "expired" | "cancelled" | "consumed";
  decidedBy?: string | null;
  decidedAt?: string | null;
  reason?: string | null;
  expiresAt: string;
}

/**
 * Map a contract ApprovalRequest to the mock ApprovalRequest shape that
 * sys-pilot components consume.
 */
export function toApprovalRequestRow(
  a: ContractApprovalRequest,
): MockApprovalRequest {
  return {
    id: a.id,
    actor: a.actorUsername,
    tool: a.tool,
    summary: a.summary,
    args_preview: JSON.stringify(a.argsPreview),
    requested_at: a.requestedAt,
    status: mapApprovalStatus(a.status),
    reason: a.reason ?? undefined,
  };
}

function mapApprovalStatus(
  s: ContractApprovalRequest["status"],
): MockApprovalRequest["status"] {
  switch (s) {
    case "approved":
    case "consumed":
      return "approved";
    case "denied":
    case "expired":
    case "cancelled":
      return "denied";
    case "pending":
    default:
      return "pending";
  }
}
