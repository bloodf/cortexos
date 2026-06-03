/**
 * /terminal — page server load.
 *
 * The terminal page is admin-only by virtue of the (authed) layout's
 * `requireAuth` (redirect to /login) plus a server-side `requireAdmin`
 * re-check here. We don't want a non-admin even rendering the page —
 * the Terminal page is privileged.
 *
 * Returns the allowlisted terminal ops (a serializable subset of
 * `AllowlistEntry`) so the page can render the quick-picker.
 *
 * M2-WS2: the page is read-only in the sense that it does NOT itself
 * touch the host — every op runs through the PTY bridge at
 * `/api/terminal` (which the M1-WS4 PB-2 fix already guards).
 */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listTerminalOps } from '$lib/server/terminal/pty-bridge';

export const load: PageServerLoad = ({ locals }) => {
  // The (authed) layout already requires `locals.user`; we additionally
  // require admin to render this privileged page. Without this, a
  // logged-in non-admin could see the terminal UI but get 403 on
  // every op — a worse UX than just redirecting.
  if (!locals.user) {
    throw error(401, 'Authentication required');
  }
  if (!locals.user.isAdmin) {
    throw error(403, 'Admin role required to use the terminal page');
  }

  return {
    user: locals.user,
    session: locals.session ?? null,
    ops: listTerminalOps(),
  };
};
