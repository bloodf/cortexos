/**
 * /approvals — pending approvals list page server load.
 *
 * Returns the pending approvals queue from the DB.
 */
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db/client';
import { listPendingApprovals } from '$lib/server/db/repos/pending_approvals';
import type { PendingApproval as DbPendingApproval } from '$lib/server/db/schema';
import type { PendingApproval } from '$lib/server/entities';
import {
  adaptApprovalList,
  filterByAgeBucket,
  filterByQuery,
  filterByStatus,
  type AgeBucket,
} from '$lib/components/approvals/adapter';

const VALID_AGE: ReadonlyArray<AgeBucket> = ['all', 'lt1h', 'lt24h', 'gt24h'];

function coerceAge(raw: string | null): AgeBucket {
  if (raw && (VALID_AGE as readonly string[]).includes(raw)) {
    return raw as AgeBucket;
  }
  return 'all';
}

/** Bridge DB row (number id, Date timestamps) to entity shape (string id, ISO strings). */
function toEntity(row: DbPendingApproval): PendingApproval {
  return {
    id: String(row.id) as PendingApproval['id'],
    runId: row.runId,
    signalName: row.signalName,
    role: row.role,
    issueId: row.issueId,
    reason: row.reason,
    requestedAt: row.requestedAt instanceof Date ? row.requestedAt.toISOString() : row.requestedAt,
    timeoutAt: row.timeoutAt instanceof Date ? row.timeoutAt.toISOString() : row.timeoutAt,
    resolvedAt: row.resolvedAt instanceof Date ? row.resolvedAt.toISOString() : row.resolvedAt,
    decision: row.decision as PendingApproval['decision'],
    approver: row.approver,
  };
}

export const load: PageServerLoad = async (event) => {
  const user = event.locals.user;
  if (!user) {
    throw error(401, 'Authentication required');
  }
  const isCortexAdmin = user.groupMemberships?.some(
    (g) => g.name === 'cortexos-admin' && g.isAdmin,
  );
  if (!user.isAdmin && !isCortexAdmin) {
    throw error(403, 'Admin access required');
  }

  const actionQ = event.url.searchParams.get('action') ?? '';
  const userQ = event.url.searchParams.get('user') ?? '';
  const ageQ = coerceAge(event.url.searchParams.get('age'));

  const db = getDb();
  const { rows } = await listPendingApprovals(db, { openOnly: false, pageSize: 500 });
  const all = adaptApprovalList(rows.map(toEntity));

  const pending = filterByStatus(all, 'pending').concat(
    filterByStatus(all, 'expired'),
  );

  const needle = `${actionQ} ${userQ}`.trim();
  const visible = filterByQuery(pending, needle);
  const filtered = filterByAgeBucket(visible, ageQ);

  return {
    approvals: filtered,
    total: pending.length,
    initialAction: actionQ,
    initialUser: userQ,
    initialAge: ageQ,
    session: event.locals.session,
  };
};
