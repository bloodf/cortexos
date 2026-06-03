/**
 * /logout page (M2-WS3, Kleppmann).
 *
 * Browser-initiated logout. The page server-load redirects to
 * /login (we don't want a GET to /logout to silently destroy a
 * session — that would be a CSRF vulnerability). The form
 * `action` posts to /api/auth/logout to do the real work.
 */

import { redirect } from '@sveltejs/kit';
import { clearSessionCookie } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  // Never let GET /logout destroy a session. Bounce to /login.
  throw redirect(303, '/login');
};

export const actions: Actions = {
  default: async ({ cookies }) => {
    // Best-effort: clear cookies. The full flow (DB delete + audit)
    // runs through POST /api/auth/logout, which the client hits
    // after this redirect.
    clearSessionCookie(cookies as never);
    throw redirect(303, '/login');
  },
};
