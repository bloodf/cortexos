/**
 * Adapter — bridge the server-side `PendingApproval` row to the
 * UI-friendly `Approval` shape used by the components and pages.
 *
 * Why this exists:
 *   - The server stores `decision: 'approve' | 'deny' | 'timeout' | null`
 *     (matches the SQL CHECK constraint from migration 001).
 *   - The UI groups results into a `status: 'pending' | 'approved' | 'denied' | 'expired' | 'timeout' | 'unknown'`
 *     vocabulary. `deny` and `timeout` both surface as "no longer
 *     actionable" — the difference matters for the audit trail but
 *     not for the pending list view.
 *   - The UI also needs an `age` (seconds since requestedAt), a
 *     derived `expiredByTimeout` boolean, and a `requestorId` /
 *     `requestorName` split (the row only carries `approver`).
 *
 * The adapter is the single place where these mappings live. Both
 * the list page, the detail page, and the history view go through
 * `adaptApproval` so the UI never has to deal with both shapes.
 */
import type { PendingApproval } from '$lib/server/entities';

/**
 * UI-friendly approval shape. Mirrors what the contracts package
 * will eventually expose for the approvals surface (the M2 work
 * establishes the boundary; the M3 contracts package will freeze it).
 */
export interface Approval {
  id: string;
  runId: string;
  signalName: string;
  role: string | null;
  issueId: string | null;
  reason: string | null;
  requestedAt: string;
  timeoutAt: string | null;
  resolvedAt: string | null;
  decision: 'approve' | 'deny' | 'timeout' | null;
  approver: string | null;
  /** Derived — one of: pending | approved | denied | expired | timeout | unknown. */
  status: ApprovalStatus;
  /** Age in seconds since `requestedAt` (negative if in the future). */
  ageSec: number;
  /** True if `timeoutAt` is set and in the past. */
  expiredByTimeout: boolean;
  /** True if the approval can still be granted/revoked by an admin. */
  actionable: boolean;
}

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'timeout'
  | 'unknown';

export const APPROVAL_STATUSES: ReadonlyArray<ApprovalStatus> = [
  'pending',
  'approved',
  'denied',
  'expired',
  'timeout',
  'unknown',
] as const;

const MS_PER_SEC = 1000;

function nowMs(): number {
  return Date.now();
}

function isoToMs(iso: string): number {
  return new Date(iso).getTime();
}

function ageSec(iso: string, ref: number): number {
  const ms = isoToMs(iso);
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.floor((ref - ms) / MS_PER_SEC));
}

/** Map a server decision to the UI status vocabulary. */
function statusFor(row: PendingApproval, ref: number): ApprovalStatus {
  if (row.decision === 'approve') return 'approved';
  if (row.decision === 'deny') return 'denied';
  if (row.decision === 'timeout') return 'timeout';
  // No decision yet — check whether the row has timed out.
  if (row.timeoutAt) {
    const t = isoToMs(row.timeoutAt);
    if (!Number.isNaN(t) && t < ref) return 'expired';
  }
  return 'pending';
}

/** Convert a server row to a UI approval. Pure function. */
export function adaptApproval(row: PendingApproval, ref: number = nowMs()): Approval {
  const status = statusFor(row, ref);
  const expiredByTimeout =
    status === 'expired' ||
    (row.timeoutAt !== null && isoToMs(row.timeoutAt) < ref && row.decision === null);
  return {
    id: row.id,
    runId: row.runId,
    signalName: row.signalName,
    role: row.role,
    issueId: row.issueId,
    reason: row.reason,
    requestedAt: row.requestedAt,
    timeoutAt: row.timeoutAt,
    resolvedAt: row.resolvedAt,
    decision: row.decision,
    approver: row.approver,
    status,
    ageSec: ageSec(row.requestedAt, ref),
    expiredByTimeout,
    actionable: status === 'pending' || status === 'expired',
  };
}

export function adaptApprovalList(
  rows: readonly PendingApproval[],
  ref: number = nowMs(),
): Approval[] {
  return rows.map((r) => adaptApproval(r, ref));
}

/** Filter predicate helper — narrow a list to a given status. */
export function filterByStatus(
  rows: readonly Approval[],
  status: ApprovalStatus | 'all',
): Approval[] {
  if (status === 'all') return rows.slice();
  return rows.filter((r) => r.status === status);
}

/** Bucket the age in seconds into the list-page filter chips. */
export type AgeBucket = 'all' | 'lt1h' | 'lt24h' | 'gt24h';

export function bucketFor(ageSec: number): AgeBucket {
  if (ageSec < 60 * 60) return 'lt1h';
  if (ageSec < 24 * 60 * 60) return 'lt24h';
  return 'gt24h';
}

/**
 * Filter the rows by an age bucket.
 *
 * Semantics (matches the UI labels):
 *   - `lt1h`   — strictly less than 1 hour
 *   - `lt24h`  — strictly less than 24 hours (includes the `lt1h` slice)
 *   - `gt24h`  — greater than or equal to 24 hours
 *   - `all`    — no filter
 */
export function filterByAgeBucket(rows: readonly Approval[], bucket: AgeBucket): Approval[] {
  if (bucket === 'all') return rows.slice();
  const ONE_HOUR = 60 * 60;
  const ONE_DAY = 24 * ONE_HOUR;
  return rows.filter((r) => {
    switch (bucket) {
      case 'lt1h':
        return r.ageSec < ONE_HOUR;
      case 'lt24h':
        return r.ageSec < ONE_DAY;
      case 'gt24h':
        return r.ageSec >= ONE_DAY;
      default:
        return true;
    }
  });
}

/** Free-text filter on the action / signal / run / reason. */
export function filterByQuery(
  rows: readonly Approval[],
  query: string,
): Approval[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows.slice();
  return rows.filter((r) => {
    return (
      r.signalName.toLowerCase().includes(needle) ||
      r.runId.toLowerCase().includes(needle) ||
      (r.reason ?? '').toLowerCase().includes(needle) ||
      (r.role ?? '').toLowerCase().includes(needle) ||
      (r.issueId ?? '').toLowerCase().includes(needle) ||
      (r.approver ?? '').toLowerCase().includes(needle)
    );
  });
}

/** Display string for the status (resolves through `t(messages, 'approvals.status.*')`). */
export function statusToI18nKey(status: ApprovalStatus): string {
  switch (status) {
    case 'pending':
      return 'approvals.status.pending';
    case 'approved':
      return 'approvals.status.approved';
    case 'denied':
      return 'approvals.status.denied';
    case 'expired':
      return 'approvals.status.expired';
    case 'timeout':
      return 'approvals.status.timeout';
    case 'unknown':
      return 'approvals.status.unknown';
  }
}

/** Format an age in seconds as `1h 23m` / `5m` / `12s`. */
export function formatAge(ageSec: number): string {
  if (ageSec < 60) return `${ageSec}s`;
  const totalMin = Math.floor(ageSec / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours < 24) return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours === 0 ? `${days}d` : `${days}d ${remHours}h`;
}
