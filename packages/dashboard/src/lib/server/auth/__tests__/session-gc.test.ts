/**
 * session-gc.test.ts — coverage for the in-memory session store's
 * `gcExpired()` and the Drizzle-backed `gcExpiredSessions()`.
 *
 * The Drizzle path requires a PGlite engine (or real Postgres);
 * the in-memory path is exercised here with a few expired rows
 * pre-loaded via the store's public API.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemorySessionStore,
} from '../session-store';

beforeEach(() => {
  // Nothing to reset for the in-memory store; each test creates a
  // fresh instance.
});

describe('InMemorySessionStore.gcExpired', () => {
  it('removes rows whose expiresAt is in the past', async () => {
    const store = new InMemorySessionStore();
    const user = store.upsertUser({
      username: 'gcuser',
      groupMemberships: ['cortexos-users' as const],
    });
    const past = Date.now() - 1000;
    // Manually create a session with an already-expired expiresAt.
    const expired = await store.createSession({
      username: user.username,
      csrfToken: 'csrf-expired',
      ip: '127.0.0.1',
      userAgent: 'test/1.0',
      isAdmin: false,
      ttlMs: -1000, // already expired
    });
    const fresh = await store.createSession({
      username: user.username,
      csrfToken: 'csrf-fresh',
      ip: '127.0.0.1',
      userAgent: 'test/1.0',
      isAdmin: false,
    });
    expect(expired.session.expiresAt).toBeLessThan(Date.now());
    expect(fresh.session.expiresAt).toBeGreaterThan(Date.now());
    const result = await store.gcExpired();
    expect(result.deleted).toBe(1);
    expect(result.ranAt).toBeGreaterThan(0);
    // The fresh session still resolves.
    const resolved = await store.resolveByToken(fresh.token);
    expect(resolved?.session.id).toBe(fresh.session.id);
    // The expired session no longer resolves.
    const goneResolved = await store.resolveByToken(expired.token);
    expect(goneResolved).toBeNull();
  });

  it('is a no-op when no rows are expired', async () => {
    const store = new InMemorySessionStore();
    const user = store.upsertUser({
      username: 'fresh',
      groupMemberships: ['cortexos-users' as const],
    });
    await store.createSession({
      username: user.username,
      csrfToken: 'csrf',
      ip: '127.0.0.1',
      userAgent: 'test/1.0',
      isAdmin: false,
    });
    const result = await store.gcExpired();
    expect(result.deleted).toBe(0);
  });

  it('removes multiple expired rows in one pass', async () => {
    const store = new InMemorySessionStore();
    const user = store.upsertUser({
      username: 'multi',
      groupMemberships: ['cortexos-users' as const],
    });
    for (let i = 0; i < 5; i++) {
      await store.createSession({
        username: user.username,
        csrfToken: `csrf-${i}`,
        ip: '127.0.0.1',
        userAgent: 'test/1.0',
        isAdmin: false,
        ttlMs: -1000,
      });
    }
    // Plus one fresh
    await store.createSession({
      username: user.username,
      csrfToken: 'csrf-fresh',
      ip: '127.0.0.1',
      userAgent: 'test/1.0',
      isAdmin: false,
    });
    const result = await store.gcExpired();
    expect(result.deleted).toBe(5);
  });
});
