/**
 * CortexOS dashboard — server hooks.
 *
 * M2-WS3 (Kleppmann) wires the real session resolution here.
 *
 * Lifecycle per request:
 *
 *   1. `event.locals` is reset (M1-WS2 contract: locals must not be
 *      assigned outside the hook).
 *   2. If a `cortexos_session` cookie is present, the session is
 *      resolved via `getSessionStore().resolveByToken()`. A stale
 *      token (unknown OR expired) is dropped silently.
 *   3. If the resolved session's `lastRoleCheckAt` is older than
 *      ROLE_CHECK_TTL_MS, the role is re-validated against the PAM
 *      group set (THREAT_MODEL SR-011/SR-012 — a demoted admin
 *      loses the role within one minute).
 *   4. If the session is valid, the rolling expiry is touched
 *      (extends `expires_at` to now + 30d, capped at
 *      `created_at + 30d`).
 *   5. `event.locals.user` + `event.locals.session` are populated
 *      for the route handlers and `requireAuth` to consume.
 *   6. Security headers (X-Content-Type-Options, Referrer-Policy,
 *      X-Frame-Options, Permissions-Policy) are applied to every
 *      response.
 *
 * Locals shape (see `src/app.d.ts`):
 *   locals.user:     User | null
 *   locals.session:  Session | null
 *   locals.requestId: string
 */

import type { Handle } from '@sveltejs/kit';
import type { User as ContractUser, Session as ContractSession } from '@cortexos/contracts';
import {
  clearSessionCookie,
  DEFAULT_SESSION_TTL_MS,
  getPamAuthenticator,
  getSessionCookie,
  getSessionStore,
  setSessionCookie,
} from '$lib/server/auth';

// ---------------------------------------------------------------------------
// Security headers — applied to every response (M1-WS2 baseline).
// CSP / HSTS are set at the reverse proxy (Caddy) and are not
// emitted here; the dashboard itself does not control the framing
// of the SPA, only the framework-agnostic headers.
// ---------------------------------------------------------------------------

const FRAMEWORK_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/** TTL between role re-validations. Per SR-011/012, 60s. */
const ROLE_CHECK_TTL_MS = 60_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newRequestId(): string {
  // 16 hex chars; collision-rare for single-process dev. Production
  // uses crypto.randomUUID() — kept as a fallback for older runtimes.
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  ).padStart(16, '0');
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Reset locals (M1-WS2 contract).
  event.locals.requestId = newRequestId();
  event.locals.user = null;
  event.locals.session = null;

  // 2. Read + resolve session cookie.
  const token = getSessionCookie(event.cookies as never);
  if (token) {
    const store = getSessionStore();
    const resolved = await store.resolveByToken(token);
    if (resolved) {
      // Bridge: resolved.user is the auth module's local User (string-typed
      // GroupMembership, integer IDs, lastRoleCheckAt) and the App.Locals
      // contracts User has the wire-format shape (UUID, object GroupMembership,
      // lastRoleCheck). The runtime values are populated by toUserEntity /
      // rowToUser / resolveByToken — see A1 fix b1e84e3 for isAdmin. A full
      // type re-type is deferred; the bounded cast here is the only place
      // the two shapes meet.
      event.locals.user = resolved.user as unknown as ContractUser;
      event.locals.session = resolved.session as unknown as ContractSession;

      // 3. Re-validate role if stale (SR-011/012).
      const now = Date.now();
      if (now - (resolved.session as { lastRoleCheckAt?: number }).lastRoleCheckAt! > ROLE_CHECK_TTL_MS) {
        try {
          const pam = getPamAuthenticator();
          const isAdmin = await pam.isAdmin(resolved.user.username);
          // Update the DB record; the in-memory projection is
          // re-read on the next request. This avoids a write
          // per-request in the hot path.
          await store.revalidateRole(token, isAdmin);
        } catch {
          // PAM unavailable (e.g. boot) — keep the cached role.
        }
      }

      // 4. Touch (rolling 30-day expiry).
      try {
        const touched = await store.touch(token, DEFAULT_SESSION_TTL_MS);
        if (touched) {
          // Re-issue the cookie with the new Max-Age so the
          // browser aligns its eviction with the server.
          setSessionCookie(event.cookies as never, token);
        }
      } catch {
        // Touch is best-effort; if the DB is briefly unavailable
        // the session is still valid for the current request.
      }
    } else {
      // Stale token. Drop the cookie so the browser stops sending it.
      clearSessionCookie(event.cookies as never);
    }
  }

  // 5. Resolve.
  const response = await resolve(event);

  // 6. Security headers.
  for (const [name, value] of Object.entries(FRAMEWORK_HEADERS)) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }

  return response;
};
