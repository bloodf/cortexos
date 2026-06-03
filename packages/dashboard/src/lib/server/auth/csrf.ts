/**
 * CSRF guard — double-submit cookie verification.
 *
 * M2-WS3 (Kleppmann) implements the CSRF check required by
 * THREAT_MODEL SR-004. Every state-changing request must:
 *   1. Carry the session cookie (HttpOnly; set automatically by the
 *      browser on same-origin XHR / form posts).
 *   2. Carry the CSRF cookie (cortexos_csrf) AND echo its value in
 *      the `X-CSRF-Token` request header.
 *
 * The server compares the two values (cookie vs header) AND the
 * session-bound csrfToken (stored in the `admin_sessions` row). If
 * any of the three is missing or mismatched, the request is
 * rejected with 403.
 *
 * The "session-bound" check is what makes the double-submit pattern
 * strict: a stolen CSRF cookie alone is not enough; the attacker
 * also needs the server-side session, which is in HttpOnly cookies
 * and tied to the DB row.
 *
 * Public API:
 *   - csrfIsSafeMethod(method) → boolean
 *   - requireCsrf(event) → void  (throws ApiError on 403)
 *   - csrfHeadersFromRequest(request) → { token: string } | null
 *
 * SvelteKit-only API:
 *   The `requireCsrf` helper reads cookies via the `CookieJar` it
 *   receives, so it works against the real SvelteKit `cookies` and
 *   the in-test cookie jar.
 */

import { CSRF_HEADER, getCsrfCookie, safeCsrfEqual, type CookieJar } from './cookies';
import { authError, permissionError } from '../errors/types';
import type { AuthRequestEvent } from './index';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** HTTP methods that do NOT require a CSRF check. */
const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The "bootstrap" CSRF token issued by the /login page on first
 * visit. The header and cookie must both be this value for the
 * login POST to pass the double-submit check. A real session-bound
 * token replaces it on a successful login.
 */
export const LOGIN_BOOTSTRAP_CSRF = 'login-bootstrap';

/** Is the method safe (does not change server state)? */
export function csrfIsSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

/**
 * Pull the CSRF token from the request header. Returns `null` if
 * missing. Used by callers that need to compare manually.
 */
export function csrfHeadersFromRequest(request: Request): string | null {
  return request.headers.get(CSRF_HEADER);
}

/**
 * Enforce the CSRF check. On state-changing methods, the request
 * MUST carry:
 *   - a non-empty X-CSRF-Token header
 *   - a non-empty cortexos_csrf cookie
 *   - both equal to the `expected` session-bound token (typically
 *     `event.locals.session?.csrfToken`)
 *
 * On safe methods (GET/HEAD/OPTIONS) this is a no-op.
 *
 * Throws via SvelteKit's `error()` with 403 on failure.
 */
export function requireCsrf(
  event: AuthRequestEvent,
  expected: string | null,
  jar?: CookieJar,
): void {
  if (csrfIsSafeMethod(event.request.method)) return;
  if (!expected) {
    // No session-bound CSRF token — either unauthenticated or the
    // session is missing the field. Treat as 403; the route's own
    // auth gate will produce the 401.
    throwCsrfError(event, 'missing_session_csrf');
  }
  const headerToken = csrfHeadersFromRequest(event.request);
  if (!headerToken) {
    throwCsrfError(event, 'missing_header');
  }
  // Use the supplied jar, fall back to the event's cookies.
  const cookieValue = (jar ? getCsrfCookie(jar) : getCsrfCookie(event.cookies as CookieJar)) ?? '';
  if (!cookieValue) {
    throwCsrfError(event, 'missing_cookie');
  }
  // Constant-time compare header vs cookie vs session-bound token.
  // A mismatch on any of the three is a fail.
  if (
    !safeCsrfEqual(headerToken, cookieValue) ||
    !safeCsrfEqual(headerToken, expected)
  ) {
    throwCsrfError(event, 'mismatch');
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function throwCsrfError(_event: AuthRequestEvent, reason: string): never {
  // We do NOT log the reason here — the route-helper audit captures
  // the user + requestId, and we don't want to leak the CSRF
  // diagnostic to a potential attacker. The reason is for unit
  // tests to assert against.
  // eslint-disable-next-line no-console
  if (process.env.NODE_ENV !== 'production') {
    // Dev-only diagnostic; never reached in prod.
    // eslint-disable-next-line no-console
    console.debug('[cortexos/csrf] rejected', { reason });
  }
  // For the "missing_session_csrf" case, surface as auth (the
  // caller is unauthenticated and shouldn't be told CSRF exists).
  if (reason === 'missing_session_csrf') {
    throwAuthError();
  }
  throwCsrfForbidden();
}

function throwAuthError(): never {
  // The errors module's `apiError` does the same thing but with a
  // different throw class. We can't import `apiError` directly
  // (would create a cycle through errors → auth/csrf → errors) so
  // we replicate the throw contract. The status + body fields are
  // recognised by both the route-helper audit and the test shim.
  const err = authError('Authentication required');
  throw makeHttpError(err.message, 401, err.kind);
}

function throwCsrfForbidden(): never {
  const err = permissionError('CSRF token invalid or missing');
  throw makeHttpError(err.message, 403, err.kind);
}

/**
 * Build a tagged error with `status` + `body` properties that the
 * test shim and route-helper both understand. The shape matches
 * the `ApiErrorThrown` class in `../errors/index.ts`.
 */
function makeHttpError(message: string, status: number, code: string): Error {
  const e = new Error(message) as Error & {
    status: number;
    body: { message: string; code: string };
  };
  e.name = 'ApiErrorThrown';
  e.status = status;
  e.body = { message, code };
  return e;
}
