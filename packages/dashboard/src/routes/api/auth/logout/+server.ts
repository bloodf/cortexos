/**
 * POST /api/auth/logout — clear the session and cookies.
 *
 * M2-WS3 (Kleppmann). Flow:
 *
 *   1. CSRF guard (same as login).
 *   2. Read the session cookie; resolve via SessionStore.
 *   3. If resolved, delete the session row + audit-log the logout.
 *   4. Always clear the session + CSRF cookies.
 *   5. Return 200 (logout is idempotent — even a stale-cookie
 *      request gets a clean 200).
 *
 * Response codes:
 *   200 — logout complete (whether or not a session existed)
 *   403 — CSRF check failed
 *
 * Note: we do NOT redirect here. Logout is API-only; the client
 * receives 200 and decides where to navigate. (The /logout
 * page-server route redirects to /login for browser-initiated
 * form submits.)
 */

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
  clearCsrfCookie,
  clearSessionCookie,
  csrfHeadersFromRequest,
  csrfIsSafeMethod,
  getCsrfCookie,
  getSessionCookie,
  getSessionStore,
  safeCsrfEqual,
  clientIp,
  userAgent,
} from '$lib/server/auth';
import { audit } from '$lib/server/audit';
import { jsonError } from '$lib/server/errors';
import type { ApiError } from '$lib/server/errors/types';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
  // 1. CSRF guard.
  if (!csrfIsSafeMethod(request.method)) {
    const headerToken = csrfHeadersFromRequest(request);
    const cookieToken = getCsrfCookie(cookies as never);
    const sessionToken = getSessionCookie(cookies as never);
    // We need at least the header to match SOMETHING in the user's
    // possession. If both the header and cookie are missing, reject.
    if (!headerToken) {
      return jsonError({
        kind: 'permission',
        message: 'CSRF token missing',
      } satisfies ApiError);
    }
    // The header must match the cookie (or be absent in the case of
    // a session-bound token — see below). We trust the session-bound
    // csrfToken in the DB as the third check.
    if (!safeCsrfEqual(headerToken, cookieToken) && cookieToken) {
      return jsonError({
        kind: 'permission',
        message: 'CSRF token mismatch',
      } satisfies ApiError);
    }
    // If the session token is present, also verify the header
    // matches the session-bound csrfToken in the store.
    if (sessionToken) {
      const resolved = await getSessionStore().resolveByToken(sessionToken);
      if (resolved && !safeCsrfEqual(headerToken, resolved.session.csrfToken)) {
        return jsonError({
          kind: 'permission',
          message: 'CSRF token mismatch (session-bound)',
        } satisfies ApiError);
      }
    }
  }

  // 2. Resolve + delete session (best effort).
  const sessionToken = getSessionCookie(cookies as never);
  const store = getSessionStore();
  if (sessionToken) {
    const resolved = await store.resolveByToken(sessionToken);
    if (resolved) {
      await store.deleteByToken(sessionToken);
      audit({
        actorUserId: resolved.user.id,
        actorSessionId: resolved.session.id,
        actorIp: getClientAddress(),
        actorUserAgent: request.headers.get('user-agent'),
        surface: 'auth',
        action: 'auth.logout',
        target: resolved.user.username,
        result: 'success',
        errorCode: null,
        payload: { username: resolved.user.username },
      });
    }
  }

  // 3. Clear cookies (idempotent).
  clearSessionCookie(cookies as never);
  clearCsrfCookie(cookies as never);

  return json({ success: true });
};
