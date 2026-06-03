/**
 * /approvals — pending approvals list page server load.
 *
 * Returns the pending approvals queue. The page also accepts URL
 * filters: `?action=...`, `?user=...`, `?age=lt1h|lt24h|gt24h|all`
 * so the list is shareable.
 *
 * Admin gate is enforced inline in `load()` — non-admins get a
 * 403. We don't use a per-route layout because the
 * `(authed)/+layout.server.ts` parent already requires an
 * authenticated user; the extra admin check is local to this
 * subtree.
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
  // Admin gate (PB-5). The parent (authed) layout already requires
  // an authenticated user; this check ensures the user is also
  // cortexos-admin. Non-admins get a 403.
  // Note: the User entity uses `is_admin` (snake_case) to match the
  // DB column name; the +layout.svelte file uses `isAdmin` for
  // Svelte 5 prop naming. We check the underlying field here.
  const user = event.locals.user;
  if (!user || !(user.is_admin || user.groupMemberships?.includes('cortexos-admin'))) {
    throw error(403, 'Admin access required');
  }

  // URL-driven bootstrap. The list page is the single source of
  // truth; the components just receive the filter values as props.
  const actionQ = event.url.searchParams.get('action') ?? '';
  const userQ = event.url.searchParams.get('user') ?? '';
  const ageQ = coerceAge(event.url.searchParams.get('age'));

  const all = adaptApprovalList(listPendingApprovals());

  // The list view shows PENDING + EXPIRED-but-not-resolved rows.
  // Resolved rows go to /approvals/history.
  const pending = filterByStatus(all, 'pending').concat(
    filterByStatus(all, 'expired'),
  );

  // Apply the free-text filter against the `action` and `user`
  // query params (the UI exposes them as separate inputs, but the
  // adapter's combined query covers both).
  const needle = `${actionQ} ${userQ}`.trim();
  const visible = filterByQuery(pending, needle);
  const filtered = filterByAgeBucket(visible, ageQ);

  return {
    approvals: filtered,
    total: pending.length,
    initialAction: actionQ,
    initialUser: userQ,
    initialAge: ageQ,
    // Cast: the App.PageData declares `session` as required, but
    // the auth gate ensures `event.locals.session` is non-null on
    // authed routes — we forward the same value here so the
    // PageServerLoad satisfies the auto-generated OutputDataShape.
    session: event.locals.session,
  };
};
