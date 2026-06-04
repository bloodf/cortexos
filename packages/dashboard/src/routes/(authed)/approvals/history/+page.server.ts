/**
 * /approvals/history — historical approvals list page server load.
 *
 * Returns the resolved approvals (approved, denied, timeout) sorted
 * newest-first. The page accepts URL filters: `?action=...`,
 * `?user=...`, `?age=...` so the list is shareable.
 *
 * Admin gating is enforced inline (PB-5); see the `/approvals`
 * list page for the rationale.
 *
 * Data source: in-memory `stub-data` for M2. M3 will swap to the
 * Drizzle repo (`repos/pending_approvals.ts`) and to `locals.db`.
 */
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { listPendingApprovals } from '$lib/server/stub-data';
import {
  adaptApprovalList,
  filterByAgeBucket,
  filterByQuery,
  filterByStatus,
  type AgeBucket,
} from '$lib/components/approvals/adapter';

const VALID_AGE: ReadonlyArray<AgeBucket> = ['all', 'lt1h', 'lt24h', 'gt24h'];

/** Coerce a URL param to one of the valid `AgeBucket` values. */
function coerceAge(raw: string | null): AgeBucket {
  if (raw && (VALID_AGE as readonly string[]).includes(raw)) {
    return raw as AgeBucket;
  }
  return 'all';
}

export const load: PageServerLoad = async (event) => {
  // Admin gate (PB-5). See the list page for the snake_case note.
  const user = event.locals.user;
  if (!user || !(user.is_admin || user.groupMemberships?.includes('cortexos-admin'))) {
    throw error(403, 'Admin access required');
  }

  const actionQ = event.url.searchParams.get('action') ?? '';
  const userQ = event.url.searchParams.get('user') ?? '';
  const ageQ = coerceAge(event.url.searchParams.get('age'));

  const all = adaptApprovalList(listPendingApprovals());

  // History = everything that has a decision. We surface
  // approved/denied/timeout but NOT pending/expired.
  const resolved = filterByStatus(all, 'approved')
    .concat(filterByStatus(all, 'denied'))
    .concat(filterByStatus(all, 'timeout'));

  const needle = `${actionQ} ${userQ}`.trim();
  const visible = filterByQuery(resolved, needle);
  const filtered = filterByAgeBucket(visible, ageQ);

  return {
    approvals: filtered,
    total: resolved.length,
    initialAction: actionQ,
    initialUser: userQ,
    initialAge: ageQ,
    // Cast: see the list page for the rationale (App.PageData
    // declares `session` as required).
    session: event.locals.session,
  };
};
