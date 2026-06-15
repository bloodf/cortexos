/**
 * Barrel export for the LIVE entity adapters.
 *
 * Only `services` and `mail` adapters are live. The alerts/audit/approvals/incus
 * adapters were dead code — their row-mappers live INLINE in
 * `src/lib/api/client.ts` (toAlertRuleRow, toAuditEntryRow, toApprovalRequestRow,
 * toIncusInstance). The standalone adapter files had no live importers and were
 * removed (MP-028 / item 1.2). Do not re-add re-exports for them here.
 *
 * Usage:
 *   import { toServiceRow, toMailReviewRow } from "@/lib/adapters";
 */
export * from "./services";
export * from "./mail";
