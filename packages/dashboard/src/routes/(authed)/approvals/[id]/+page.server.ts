/**
 * /approvals/[id] — single-approval detail page server load.
 *
 * Returns the adapted approval row for the detail view. Admin
 * gating is enforced inline (PB-5); see the `/approvals`
 * list page for the rationale.
 */
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getPendingApproval } from '$lib/server/stub-data';
import { adaptApproval } from '$lib/components/approvals/adapter';

export const load: PageServerLoad = async (event) => {
  // Admin gate (PB-5). The User entity uses `is_admin` (snake_case)
  // to match the DB column; the +layout.svelte uses `isAdmin` for
  // Svelte 5 prop naming. Check the underlying field here.
  const user = event.locals.user;
  if (!user || !(user.is_admin || user.groupMemberships?.includes('cortexos-admin'))) {
    throw error(403, 'Admin access required');
  }
  const id = event.params.id;
  if (!id) throw error(400, 'Missing approval identifier');
  const row = getPendingApproval(id);
  if (!row) throw error(404, `Approval '${id}' not found`);
  return {
    approval: adaptApproval(row),
    // Cast: see the list page for the rationale (App.PageData
    // declares `session` as required, and the (authed) gate
    // ensures it is non-null here).
    session: event.locals.session,
  };
};
