// @vitest-environment node
/**
 * WP-01 unit tests for the ported in-memory session store + resolveContext
 * lifecycle (the production Drizzle store is covered by WP-02's users repo).
 * Verifies: create/resolve, expiry never resolves, rolling touch with the
 * absolute-lifetime cap, role re-validation cache, and that resolveContext
 * drops a stale cookie + re-validates role on a TTL.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  InMemorySessionStore,
  setSessionStore,
  resetSessionStore,
  generateSessionToken,
  DEFAULT_SESSION_TTL_MS,
} from '../session-store';
import { resolveContext } from '../../context';
import { SESSION_COOKIE } from '../../config';
import { setPamAuthenticator, resetPamAuthenticator, FakePamAuthenticator } from '../pam';

let store: InMemorySessionStore;

beforeEach(() => {
  resetSessionStore();
  store = new InMemorySessionStore();
  setSessionStore(store);
});

afterEach(() => {
  vi.useRealTimers();
  resetPamAuthenticator();
});

async function newSession(isAdmin = false) {
  return store.createSession({
    username: isAdmin ? 'admin' : 'alice',
    csrfToken: generateSessionToken(),
    ip: '127.0.0.1',
    userAgent: 'vitest',
    isAdmin,
  });
}

describe('InMemorySessionStore', () => {
  it('creates and resolves a session', async () => {
    const { token } = await newSession();
    const resolved = await store.resolveByToken(token);
    expect(resolved).not.toBeNull();
    expect(resolved!.user.username).toBe('alice');
    expect(resolved!.isAdmin).toBe(false);
  });

  it('never resolves an unknown token', async () => {
    expect(await store.resolveByToken('nope')).toBeNull();
  });

  it('never resolves an expired session (SR-001)', async () => {
    const { token } = await store.createSession({
      username: 'alice',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: false,
      ttlMs: -1, // already expired
    });
    expect(await store.resolveByToken(token)).toBeNull();
  });

  it('admin session reports admin groups', async () => {
    const { token } = await newSession(true);
    const resolved = await store.resolveByToken(token);
    expect(resolved!.isAdmin).toBe(true);
    expect(resolved!.groups).toContain('cortexos-admin');
  });

  it('touch extends expiry but caps at created + ttl', async () => {
    const { token, session } = await newSession();
    const created = session.expiresAt - DEFAULT_SESSION_TTL_MS;
    const touched = await store.touch(token, DEFAULT_SESSION_TTL_MS);
    expect(touched).not.toBeNull();
    expect(touched!.expiresAt).toBeLessThanOrEqual(created + DEFAULT_SESSION_TTL_MS + 1000);
  });

  it('revalidateRole updates the cached admin flag', async () => {
    const { token } = await newSession(true);
    await store.revalidateRole(token, false);
    const resolved = await store.resolveByToken(token);
    expect(resolved!.isAdmin).toBe(false);
  });

  it('deleteByToken + sweepExpired work', async () => {
    const { token } = await newSession();
    expect(await store.deleteByToken(token)).toBe(true);
    expect(await store.resolveByToken(token)).toBeNull();
  });
});

describe('resolveContext lifecycle', () => {
  it('resolves a valid session cookie into ctx.user/ctx.session', async () => {
    const { token } = await newSession();
    const ctx = await resolveContext(
      new Request('http://localhost/api/x', {
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
      }),
    );
    expect(ctx.user?.username).toBe('alice');
    expect(ctx.session).not.toBeNull();
  });

  it('drops a stale token silently and clears the cookie', async () => {
    const ctx = await resolveContext(
      new Request('http://localhost/api/x', {
        headers: { cookie: `${SESSION_COOKIE}=${generateSessionToken()}` },
      }),
    );
    expect(ctx.user).toBeNull();
    const setCookies = ctx.cookies.serializeSetCookies().join('\n');
    expect(setCookies).toContain(`${SESSION_COOKIE}=`);
    expect(setCookies).toContain('Max-Age=0');
  });

  it('re-validates role via PAM when the cache is older than 60s', async () => {
    const { token } = await newSession(true);
    // Force the cached role check to be stale.
    await store.revalidateRole(token, true);
    // Manually age lastRoleCheckAt past the 60s TTL.
    const row = (store as unknown as { sessions: Map<string, { lastRoleCheckAt: number }> }).sessions.get(token)!;
    row.lastRoleCheckAt = Date.now() - 61_000;

    // PAM now reports the admin has been demoted.
    const pam = new FakePamAuthenticator();
    pam.setFakeUser({ username: 'admin', password: 'pw', groups: ['cortexos-users'] });
    setPamAuthenticator(pam);

    await resolveContext(
      new Request('http://localhost/api/x', {
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
      }),
    );
    // The demoted role is now cached.
    const resolved = await store.resolveByToken(token);
    expect(resolved!.isAdmin).toBe(false);
  });

  it('returns an empty ctx when no session cookie is present', async () => {
    const ctx = await resolveContext(new Request('http://localhost/api/x'));
    expect(ctx.user).toBeNull();
    expect(ctx.session).toBeNull();
    expect(ctx.requestId).toHaveLength(16);
  });
});
