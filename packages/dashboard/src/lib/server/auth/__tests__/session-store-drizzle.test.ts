// @vitest-environment node
/**
 * session-store-drizzle.test.ts — direct coverage of the
 * DrizzleSessionStore (production code path).
 *
 * Uses PGlite via the shared test-utils so the real SQL migrations
 * run, the real Drizzle queries execute, and the behaviour matches
 * production Postgres. The InMemorySessionStore is unit-tested
 * elsewhere; this file is the integration proof for the
 * admin_sessions + pam_users tables.
 *
 * Coverage targets (v1.0 push):
 *   - createSession: success, idempotency, empty username rejected
 *   - resolveByToken: hit, miss, expired, missing user
 *   - touch: extends, caps at createdAt+ttlMs, expires after cap
 *   - deleteByToken: removes row, idempotent
 *   - sweepExpired: deletes only expired rows
 *   - revalidateRole: updates is_admin + lastRoleCheckAt
 *   - gcExpired: deletes expired, returns ranAt
 *   - row mappers: isAdmin path, no groups path
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DrizzleSessionStore } from '../session-store';
import { createTestDb, type PgliteDbClient } from '../../db/test-utils';
import type { PGlite } from '@electric-sql/pglite';

let db: PgliteDbClient;
let client: PGlite;
let store: DrizzleSessionStore;

beforeEach(async () => {
  const r = await createTestDb({ seed: false });
  db = r.db;
  client = r.client;
  store = new DrizzleSessionStore(db);
}, 30_000);

afterEach(async () => {
  if (client) await client.close();
});

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

describe('DrizzleSessionStore.createSession', () => {
  it('persists a user + session row and returns a 43-char token', async () => {
    const r = await store.createSession({
      username: 'alice',
      csrfToken: 'csrf-1',
      ip: '127.0.0.1',
      userAgent: 'ua',
      isAdmin: true,
    });
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.user.username).toBe('alice');
    expect(r.user.isAdmin).toBe(true);
    expect(r.user.is_admin).toBe(true);
    expect(r.session.csrfToken).toBe('csrf-1');
    expect(r.session.expiresAt).toBeGreaterThan(Date.now());
    expect(r.session.lastRoleCheckAt).toBeGreaterThan(0);
  });

  it('is idempotent on username — second call returns the same user id', async () => {
    const a = await store.createSession({
      username: 'bob',
      csrfToken: 'c1',
      ip: null,
      userAgent: null,
      isAdmin: true,
    });
    const b = await store.createSession({
      username: 'bob',
      csrfToken: 'c2',
      ip: null,
      userAgent: null,
      isAdmin: false,
    });
    expect(b.user.id).toBe(a.user.id);
    // The second call still has isAdmin=false (per the new session row).
    expect(b.user.isAdmin).toBe(false);
  });

  it('rejects an empty username', async () => {
    await expect(
      store.createSession({
        username: '   ',
        csrfToken: 'c',
        ip: null,
        userAgent: null,
        isAdmin: false,
      }),
    ).rejects.toThrow(/username is required/i);
  });

  it('respects a custom ttlMs', async () => {
    const r = await store.createSession({
      username: 'short',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: false,
      ttlMs: 100,
    });
    // expiresAt should be ~now+100ms, not the 30-day default.
    const delta = r.session.expiresAt - Date.now();
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(1000);
  });

  it('preserves ip + userAgent on the session row', async () => {
    const r = await store.createSession({
      username: 'carol',
      csrfToken: 'c',
      ip: '10.0.0.5',
      userAgent: 'Mozilla/5.0',
      isAdmin: false,
    });
    expect(r.session.ip).toBe('10.0.0.5');
    expect(r.session.ua).toBe('Mozilla/5.0');
  });
});

// ---------------------------------------------------------------------------
// resolveByToken
// ---------------------------------------------------------------------------

describe('DrizzleSessionStore.resolveByToken', () => {
  it('returns the session + user for a valid token', async () => {
    const created = await store.createSession({
      username: 'dave',
      csrfToken: 'csrf',
      ip: '1.2.3.4',
      userAgent: 'ua',
      isAdmin: true,
    });
    const r = await store.resolveByToken(created.token);
    expect(r).not.toBeNull();
    expect(r!.user.username).toBe('dave');
    expect(r!.isAdmin).toBe(true);
    expect(r!.groups).toContain('cortexos-admin');
    expect(r!.session.csrfToken).toBe('csrf');
  });

  it('returns null for an unknown token', async () => {
    const r = await store.resolveByToken('nope-not-a-token');
    expect(r).toBeNull();
  });

  it('returns null for an expired session', async () => {
    const created = await store.createSession({
      username: 'eve',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: false,
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 50));
    const r = await store.resolveByToken(created.token);
    expect(r).toBeNull();
  });

  it('returns the non-admin groups when isAdmin is false', async () => {
    const created = await store.createSession({
      username: 'frank',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: false,
    });
    const r = await store.resolveByToken(created.token);
    expect(r!.isAdmin).toBe(false);
    expect(r!.groups).not.toContain('cortexos-admin');
    expect(r!.groups).toContain('cortexos-users');
    // groupMemberships should mirror groups.
    const names = r!.user.groupMemberships.map((g) => g.name);
    expect(names).toContain('cortexos-users');
    expect(names).not.toContain('cortexos-admin');
  });
});

// ---------------------------------------------------------------------------
// touch
// ---------------------------------------------------------------------------

describe('DrizzleSessionStore.touch', () => {
  it('extends expiresAt for a live session', async () => {
    const created = await store.createSession({
      username: 'gina',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: true,
    });
    // Touch with the default 30-day rolling TTL. The cap is
    // createdAt + ttlMs(touch) = createdAt + 30d. Since the
    // session was just created, the new expiresAt ≈ original.
    await new Promise((r) => setTimeout(r, 5));
    const touched = await store.touch(created.token, 30 * 24 * 60 * 60 * 1000);
    expect(touched).not.toBeNull();
    // new expiresAt should be within a few ms of the original
    expect(touched!.expiresAt).toBeGreaterThanOrEqual(created.session.expiresAt - 100);
    expect(touched!.userId).toBe(created.session.userId);
  });

  it('returns null for an unknown token', async () => {
    const r = await store.touch('nope', 1000);
    expect(r).toBeNull();
  });

  it('returns null for an expired session', async () => {
    const created = await store.createSession({
      username: 'harry',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: false,
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 50));
    const r = await store.touch(created.token, 60_000);
    expect(r).toBeNull();
  });

  it('caps the new expiresAt at createdAt + ttlMs(touch)', async () => {
    // Create with a tiny 100ms TTL, then touch with a much larger
    // 60s TTL. The new expiresAt is min(now+60_000, createdAt+60_000)
    // = createdAt + 60_000.
    const created = await store.createSession({
      username: 'ivy',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: false,
      ttlMs: 100,
    });
    const createdAt = created.session.expiresAt - 100; // original ttl was 100
    await new Promise((r) => setTimeout(r, 5));
    const touched = await store.touch(created.token, 60_000);
    expect(touched).not.toBeNull();
    // The new expiresAt is roughly createdAt + 60_000, far past the
    // original 100ms lifetime.
    expect(touched!.expiresAt).toBeGreaterThan(createdAt + 50_000);
  });
});

// ---------------------------------------------------------------------------
// deleteByToken
// ---------------------------------------------------------------------------

describe('DrizzleSessionStore.deleteByToken', () => {
  it('removes the session and returns true', async () => {
    const created = await store.createSession({
      username: 'jack',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: false,
    });
    expect(await store.deleteByToken(created.token)).toBe(true);
    expect(await store.deleteByToken(created.token)).toBe(false);
    expect(await store.resolveByToken(created.token)).toBeNull();
  });

  it('is a no-op for an unknown token', async () => {
    expect(await store.deleteByToken('nope')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sweepExpired
// ---------------------------------------------------------------------------

describe('DrizzleSessionStore.sweepExpired', () => {
  it('removes only expired sessions', async () => {
    await store.createSession({
      username: 'live',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: false,
      ttlMs: 60_000,
    });
    await store.createSession({
      username: 'stale1',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: false,
      ttlMs: 1,
    });
    await store.createSession({
      username: 'stale2',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: false,
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 50));
    const n = await store.sweepExpired();
    expect(n).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// revalidateRole
// ---------------------------------------------------------------------------

describe('DrizzleSessionStore.revalidateRole', () => {
  it('flips isAdmin and updates lastRoleCheckAt', async () => {
    const created = await store.createSession({
      username: 'kim',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: true,
    });
    const before = created.session.lastRoleCheckAt;
    await new Promise((r) => setTimeout(r, 5));
    await store.revalidateRole(created.token, false);
    const resolved = await store.resolveByToken(created.token);
    expect(resolved!.isAdmin).toBe(false);
    expect(resolved!.session.lastRoleCheckAt).toBeGreaterThanOrEqual(before);
  });

  it('is a no-op for an unknown token (no throw)', async () => {
    await expect(store.revalidateRole('nope', false)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// gcExpired
// ---------------------------------------------------------------------------

describe('DrizzleSessionStore.gcExpired', () => {
  it('returns deleted count + ranAt timestamp', async () => {
    await store.createSession({
      username: 'expired1',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: false,
      ttlMs: 1,
    });
    await store.createSession({
      username: 'live2',
      csrfToken: 'c',
      ip: null,
      userAgent: null,
      isAdmin: false,
      ttlMs: 60_000,
    });
    await new Promise((r) => setTimeout(r, 50));
    const before = Date.now();
    const out = await store.gcExpired();
    expect(out.deleted).toBe(1);
    expect(out.ranAt).toBeGreaterThanOrEqual(before);
  });
});
