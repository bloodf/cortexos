/**
 * GET /api/auth/me — return the current user + session, or 401.
 *
 * M2-WS3 (Kleppmann). The hook populates `event.locals.user` and
 * `event.locals.session`; this handler just serializes them.
 *
 * Response codes:
 *   200 — { user, session }
 *   401 — no valid session
 */

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getCurrentSession, isAdmin } from '$lib/server/auth';
import { jsonError } from '$lib/server/errors';
import type { ApiError } from '$lib/server/errors/types';

export const GET: RequestHandler = async (event) => {
  const resolved = await getCurrentSession(event);
  if (!resolved) {
    return jsonError({ kind: 'auth', message: 'Not authenticated' } satisfies ApiError);
  }
  return json({
    user: {
      id: resolved.user.id,
      username: resolved.user.username,
      isAdmin: isAdmin(resolved.user),
      isActive: resolved.user.isActive,
      groups: Array.from(resolved.groups),
    },
    session: {
      id: resolved.session.id,
      expiresAt: resolved.session.expiresAt,
      lastRoleCheckAt: resolved.session.lastRoleCheckAt,
    },
  });
};
