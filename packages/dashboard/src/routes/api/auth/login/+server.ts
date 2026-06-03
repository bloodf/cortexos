/**
 * POST /api/auth/login — exchange username + password + CSRF for a session.
 *
 * M2-WS3 (Kleppmann). Flow:
 *
 *   1. Parse the JSON body with Zod (username, password).
 *   2. CSRF guard: require a matching X-CSRF-Token header and
 *      cortexos_csrf cookie. The CSRF check is satisfied by either:
 *        a. The request is GET/HEAD/OPTIONS (safe method — no CSRF).
 *        b. The request is a same-origin browser navigation (SameSite=Lax
 *           cookie would not be sent on cross-site POST, so a missing
 *           CSRF here means the request is either cross-site or a
 *           non-browser client; both should fail).
 *      For login specifically, the CSRF cookie is issued on first GET
 *      to /login. A first-time login (no prior CSRF cookie) is allowed
 *      by the special `csrfToken: 'login-bootstrap'` placeholder when
 *      a header value is also present — this is a known limitation of
 *      the double-submit pattern and is mitigated by:
 *        - the SameSite=Lax cookie policy (cross-site POSTs do not
 *          carry the cookie)
 *        - the rate limit on /api/auth/login
 *        - the per-IP lockout logic
 *   3. Call getPamAuthenticator().authenticate(username, password).
 *      On failure, return 401 with a generic error (no enumeration).
 *   4. On success, fetch groups via getPamAuthenticator().getGroups().
 *      Derive `isAdmin = groups.includes('cortexos-admin')`.
 *   5. Generate a fresh CSRF token (32 bytes CSPRNG, base64url).
 *   6. Create the session via getSessionStore().createSession().
 *   7. Set the session cookie (HttpOnly) and CSRF cookie (readable).
 *   8. Audit-log the login event.
 *   9. Return 200 with the username + user object.
 *
 * On the LOGIN-BOOTSTRAP flow:
 *   The first-ever login has no prior session, so there is no
 *   pre-existing CSRF cookie to compare against. We accept a header-
 *   only CSRF token IF a matching bootstrap cookie has been issued
 *   by a prior GET. The double-submit pattern still applies: the
 *   header and cookie must match, and the cookie was set by the
 *   server in response to a same-origin GET. A cross-site attacker
 *   cannot satisfy this.
 *
 * Response codes:
 *   200 — login successful
 *   400 — invalid input (missing username/password, malformed JSON)
 *   401 — authentication failed
 *   403 — CSRF check failed
 *   429 — rate limited
 *   500 — system error
 */

import { z } from 'zod';
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import {
  csrfHeadersFromRequest,
  csrfIsSafeMethod,
  generateCsrfToken,
  getCsrfCookie,
  getPamAuthenticator,
  getSessionStore,
  LOGIN_BOOTSTRAP_CSRF,
  safeCsrfEqual,
  setCsrfCookie,
  setSessionCookie,
  clientIp,
  userAgent,
} from '$lib/server/auth';
import { audit } from '$lib/server/audit';
import { checkRateLimit } from '$lib/server/rate-limit';
import { isApiError, type ApiError } from '$lib/server/errors/types';
import { jsonError } from '$lib/server/errors';
import { RATE_LIMIT_UNAUTH_PER_60S } from '$lib/server/config';

const LoginInput = z.object({
  username: z.string().min(1, 'Username is required').max(64),
  password: z.string().min(1, 'Password is required').max(512),
});

// Re-exported for callers (login form, page server-loads) that
// need to set the bootstrap cookie before the first POST. The
// underscore prefix tells SvelteKit this is a private export
// (it would otherwise complain at build time).
export { LOGIN_BOOTSTRAP_CSRF as _LOGIN_BOOTSTRAP_CSRF } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
  // 1. Rate limit (per IP, generous but enough to deter brute force).
  const ip = getClientAddress();
  const rateKey = `ip:${ip}:/api/auth/login`;
  const rl = checkRateLimit({
    key: rateKey,
    limit: RATE_LIMIT_UNAUTH_PER_60S,
    windowSec: 60,
  });
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ message: 'Too many requests', code: 'rate_limit' }),
      {
        status: 429,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'retry-after': String(rl.retryAfterSec),
        },
      },
    );
  }

  // 2. CSRF guard. Safe methods pass; state-changing must carry the
  //    X-CSRF-Token header matching the cookie (or the bootstrap
  //    placeholder).
  if (!csrfIsSafeMethod(request.method)) {
    const headerToken = csrfHeadersFromRequest(request);
    const cookieToken = getCsrfCookie(cookies as never);
    if (!headerToken) {
      return jsonError({
        kind: 'permission',
        message: 'CSRF token missing',
      } satisfies ApiError);
    }
    // Bootstrap: accept header==cookie==LOGIN_BOOTSTRAP_CSRF.
    const isBootstrap =
      safeCsrfEqual(headerToken, LOGIN_BOOTSTRAP_CSRF) &&
      safeCsrfEqual(cookieToken, LOGIN_BOOTSTRAP_CSRF);
    if (!isBootstrap && !safeCsrfEqual(headerToken, cookieToken)) {
      return jsonError({
        kind: 'permission',
        message: 'CSRF token mismatch',
      } satisfies ApiError);
    }
  }

  // 3. Parse + validate body.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError({ kind: 'validation', message: 'Invalid JSON body', details: [] } satisfies ApiError);
  }
  const parsed = LoginInput.safeParse(raw);
  if (!parsed.success) {
    return jsonError({
      kind: 'validation',
      message: 'Invalid input',
      details: parsed.error.issues.map((i) => ({
        field: i.path.join('.') || '_root',
        message: i.message,
      })),
    } satisfies ApiError);
  }
  const { username, password } = parsed.data;

  // 4. Authenticate.
  const pam = getPamAuthenticator();
  const auth = await pam.authenticate(username, password);
  if (!auth.ok) {
    audit({
      actorUserId: null,
      actorSessionId: null,
      actorIp: clientIp({ getClientAddress } as never),
      actorUserAgent: userAgent({ request } as never),
      surface: 'auth',
      action: 'auth.login',
      target: username,
      result: 'denied',
      errorCode: auth.reason,
      payload: { username, reason: auth.reason },
    });
    return jsonError({ kind: 'auth', message: 'Invalid credentials' } satisfies ApiError);
  }

  // 5. Group lookup.
  const groups = await pam.getGroups(auth.username);
  const isAdmin = groups.includes('cortexos-admin');

  // 6. Create session.
  const csrfToken = generateCsrfToken();
  const store = getSessionStore();
  const ip2 = getClientAddress();
  const ua = request.headers.get('user-agent');
  const created = await store.createSession({
    username: auth.username,
    csrfToken,
    ip: ip2,
    userAgent: ua,
    isAdmin,
  });

  // 7. Set cookies.
  setSessionCookie(cookies as never, created.token);
  setCsrfCookie(cookies as never, csrfToken);

  // 8. Audit.
  audit({
    actorUserId: created.user.id,
    actorSessionId: created.session.id,
    actorIp: ip2,
    actorUserAgent: ua,
    surface: 'auth',
    action: 'auth.login',
    target: auth.username,
    result: 'success',
    errorCode: null,
    payload: { username: auth.username, isAdmin, groups },
  });

  // 9. Respond.
  return json({
    success: true,
    username: auth.username,
    user: {
      id: created.user.id,
      username: created.user.username,
      isAdmin,
      groups: Array.from(groups),
    },
  });
};
