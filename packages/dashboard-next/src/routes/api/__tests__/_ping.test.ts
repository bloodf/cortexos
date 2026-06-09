// @vitest-environment node
/**
 * WP-01 acceptance gate for `defineApiRoute` via the `/api/_ping` demo route.
 *
 * Asserts the security pipeline end-to-end against the wrapper cores:
 *   - 200 with a valid session, 401 without one (auth:'any').
 *   - 403 for an authenticated non-admin, 200 for an admin (auth:'admin').
 *   - 400 + {code:'validation', details:[...]} on bad input.
 *   - POST without a valid session-bound x-csrf-token → 403; with it → 201.
 *   - A stolen CSRF cookie WITHOUT the matching header is rejected (the
 *     double-submit gate is not weakened).
 *
 * Uses the in-memory session store (no DB; DB_PASSWORD is unset under test).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemorySessionStore,
  setSessionStore,
  resetSessionStore,
  generateSessionToken,
} from '@/server/auth/session-store';
import { SESSION_COOKIE, CSRF_COOKIE } from '@/server/config';
import { _resetRateLimitBuckets } from '@/server/define-api-route';
import { pingAnyCore, pingAdminCore } from '../_ping';

let store: InMemorySessionStore;

beforeEach(() => {
  resetSessionStore();
  store = new InMemorySessionStore();
  setSessionStore(store);
  _resetRateLimitBuckets();
});

/** Create a session for a user and return its cookie token + csrf token. */
async function makeSession(opts: { isAdmin: boolean }): Promise<{ token: string; csrf: string }> {
  const csrf = generateSessionToken();
  const res = await store.createSession({
    username: opts.isAdmin ? 'admin' : 'alice',
    csrfToken: csrf,
    ip: '127.0.0.1',
    userAgent: 'vitest',
    isAdmin: opts.isAdmin,
  });
  return { token: res.token, csrf };
}

function cookieHeader(parts: Record<string, string>): string {
  return Object.entries(parts)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');
}

describe('GET /api/_ping (auth: any)', () => {
  it('returns 200 with a valid session', async () => {
    const { token } = await makeSession({ isAdmin: false });
    const res = await pingAnyCore(
      new Request('http://localhost/api/_ping', {
        headers: { cookie: cookieHeader({ [SESSION_COOKIE]: token }) },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, pong: true, user: 'alice' });
  });

  it('returns 401 without a session', async () => {
    const res = await pingAnyCore(new Request('http://localhost/api/_ping'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('auth');
  });

  it('applies framework security headers', async () => {
    const { token } = await makeSession({ isAdmin: false });
    const res = await pingAnyCore(
      new Request('http://localhost/api/_ping', {
        headers: { cookie: cookieHeader({ [SESSION_COOKIE]: token }) },
      }),
    );
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });
});

describe('GET /api/_ping (auth: admin)', () => {
  it('returns 403 for an authenticated non-admin', async () => {
    const { token } = await makeSession({ isAdmin: false });
    const res = await pingAdminCore(
      new Request('http://localhost/api/_ping', {
        headers: { cookie: cookieHeader({ [SESSION_COOKIE]: token }) },
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('permission');
  });

  it('returns 200 for an admin', async () => {
    const { token } = await makeSession({ isAdmin: true });
    const res = await pingAdminCore(
      new Request('http://localhost/api/_ping', {
        headers: { cookie: cookieHeader({ [SESSION_COOKIE]: token }) },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, admin: 'admin' });
  });

  it('returns 401 for an admin route without a session', async () => {
    const res = await pingAdminCore(new Request('http://localhost/api/_ping'));
    expect(res.status).toBe(401);
  });
});

describe('input validation', () => {
  it('returns 400 with validation details on bad input', async () => {
    const { token } = await makeSession({ isAdmin: false });
    const res = await pingAnyCore(
      new Request('http://localhost/api/_ping?n=not-a-number', {
        headers: { cookie: cookieHeader({ [SESSION_COOKIE]: token }) },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('validation');
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
  });

  it('accepts a valid numeric query', async () => {
    const { token } = await makeSession({ isAdmin: false });
    const res = await pingAnyCore(
      new Request('http://localhost/api/_ping?n=7', {
        headers: { cookie: cookieHeader({ [SESSION_COOKIE]: token }) },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.n).toBe(7);
  });
});

describe('POST CSRF (double-submit + session-bound)', () => {
  it('returns 403 on POST without a CSRF header', async () => {
    const { token, csrf } = await makeSession({ isAdmin: false });
    const res = await pingAnyCore(
      new Request('http://localhost/api/_ping', {
        method: 'POST',
        headers: {
          cookie: cookieHeader({ [SESSION_COOKIE]: token, [CSRF_COOKIE]: csrf }),
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('permission');
  });

  it('rejects a CSRF cookie without the matching header (stolen-cookie attack)', async () => {
    const { token, csrf } = await makeSession({ isAdmin: false });
    // Attacker has the CSRF cookie but cannot read it to set the header.
    const res = await pingAnyCore(
      new Request('http://localhost/api/_ping', {
        method: 'POST',
        headers: {
          cookie: cookieHeader({ [SESSION_COOKIE]: token, [CSRF_COOKIE]: csrf }),
          'content-type': 'application/json',
          // NO x-csrf-token header
        },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('rejects a mismatched CSRF header (not session-bound)', async () => {
    const { token, csrf } = await makeSession({ isAdmin: false });
    const res = await pingAnyCore(
      new Request('http://localhost/api/_ping', {
        method: 'POST',
        headers: {
          cookie: cookieHeader({ [SESSION_COOKIE]: token, [CSRF_COOKIE]: csrf }),
          'content-type': 'application/json',
          'x-csrf-token': generateSessionToken(), // valid shape, wrong value
        },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('passes POST with a valid session-bound CSRF token (cookie === header === session)', async () => {
    const { token, csrf } = await makeSession({ isAdmin: false });
    const res = await pingAnyCore(
      new Request('http://localhost/api/_ping', {
        method: 'POST',
        headers: {
          cookie: cookieHeader({ [SESSION_COOKIE]: token, [CSRF_COOKIE]: csrf }),
          'content-type': 'application/json',
          'x-csrf-token': csrf,
        },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, pong: true });
  });

  it('returns 401 on POST with no session (CSRF check surfaces as auth)', async () => {
    const res = await pingAnyCore(
      new Request('http://localhost/api/_ping', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(401);
  });
});
