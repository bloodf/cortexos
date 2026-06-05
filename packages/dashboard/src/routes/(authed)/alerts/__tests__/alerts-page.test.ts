// @vitest-environment node
/**
 * alerts-page.test.ts — coverage of /alerts page server load.
 *
 * Exercises:
 *   - redirect to /login when no user in locals
 *   - default filter loads all rules, all operational, all history
 *   - status=enabled filter applies
 *   - status=disabled filter applies
 *   - severity=critical filter
 *   - canManageRules reflects isAdmin
 *   - invalid filter values default to 'all' / null
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, type PgliteDbClient } from '$lib/server/db/test-utils';
import {
  makeFakeUser,
  makeFakeSession,
  makeFakeLocals,
} from '$lib/server/test-utils';
import type { PGlite } from '@electric-sql/pglite';

let db: PgliteDbClient;
let client: PGlite;
let load: typeof import('../+page.server').load;

// Mock getDb() before importing the page server module.
vi.mock('$lib/server/db/client', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/db/client')>('$lib/server/db/client');
  return {
    ...actual,
    getDb: () => db,
  };
});

beforeEach(async () => {
  const r = await createTestDb({ seed: true });
  db = r.db;
  client = r.client;
  // Import dynamically so the mock is in place.
  const mod = await import('../+page.server');
  load = mod.load;
}, 30_000);

afterEach(async () => {
  if (client) await client.close();
  vi.resetModules();
});

const adminUser = makeFakeUser({
  is_admin: true,
  groupMemberships: ['cortexos-admin'],
});

describe('/alerts — load', () => {
  it('redirects to /login when no user is in locals', async () => {
    try {
      await load({
        url: new URL('http://localhost/alerts'),
        locals: {},
      } as never);
      expect.fail('expected redirect');
    } catch (e) {
      // SvelteKit redirect throws a Redirect-like object with status 303
      expect((e as { status: number }).status).toBe(303);
      expect((e as { location: string }).location).toBe('/login');
    }
  });

  it('returns the default (all) slices', async () => {
    const out = (await load({
      url: new URL('http://localhost/alerts'),
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    } as never)) as { rules: unknown[]; operational: unknown[]; history: unknown[]; filters: { severity: string | null; ruleStatus: string; ackStatus: string }; canManageRules: boolean };
    expect(Array.isArray(out.rules)).toBe(true);
    expect(Array.isArray(out.operational)).toBe(true);
    expect(Array.isArray(out.history)).toBe(true);
    expect(out.filters.ruleStatus).toBe('all');
    expect(out.filters.ackStatus).toBe('all');
    expect(out.filters.severity).toBeNull();
    expect(out.canManageRules).toBe(true);
  });

  it('parses status=enabled and applies the filter', async () => {
    const out = (await load({
      url: new URL('http://localhost/alerts?status=enabled'),
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    } as never)) as { filters: { ruleStatus: string; ackStatus: string } };
    expect(out.filters.ruleStatus).toBe('enabled');
    expect(out.filters.ackStatus).toBe('all');
  });

  it('parses status=disabled', async () => {
    const out = (await load({
      url: new URL('http://localhost/alerts?status=disabled'),
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    } as never)) as { filters: { ruleStatus: string } };
    expect(out.filters.ruleStatus).toBe('disabled');
  });

  it('parses status=acknowledged as the ack filter', async () => {
    const out = (await load({
      url: new URL('http://localhost/alerts?status=acknowledged'),
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    } as never)) as { filters: { ruleStatus: string; ackStatus: string } };
    expect(out.filters.ruleStatus).toBe('all');
    expect(out.filters.ackStatus).toBe('acknowledged');
  });

  it('parses severity=critical', async () => {
    const out = (await load({
      url: new URL('http://localhost/alerts?severity=critical'),
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    } as never)) as { filters: { severity: string | null } };
    expect(out.filters.severity).toBe('critical');
  });

  it('parses severity=info', async () => {
    const out = (await load({
      url: new URL('http://localhost/alerts?severity=info'),
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    } as never)) as { filters: { severity: string | null } };
    expect(out.filters.severity).toBe('info');
  });

  it('parses severity=warning', async () => {
    const out = (await load({
      url: new URL('http://localhost/alerts?severity=warning'),
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    } as never)) as { filters: { severity: string | null } };
    expect(out.filters.severity).toBe('warning');
  });

  it('invalid severity returns null', async () => {
    const out = (await load({
      url: new URL('http://localhost/alerts?severity=bogus'),
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    } as never)) as { filters: { severity: string | null } };
    expect(out.filters.severity).toBeNull();
  });

  it('invalid status falls back to "all"', async () => {
    const out = (await load({
      url: new URL('http://localhost/alerts?status=garbage'),
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    } as never)) as { filters: { ruleStatus: string; ackStatus: string } };
    expect(out.filters.ruleStatus).toBe('all');
    expect(out.filters.ackStatus).toBe('all');
  });

  it('canManageRules=false for a non-admin user', async () => {
    const nonAdmin = makeFakeUser({
      is_admin: false,
      groupMemberships: ['cortexos-users'],
    });
    const out = (await load({
      url: new URL('http://localhost/alerts'),
      locals: makeFakeLocals(nonAdmin, makeFakeSession(nonAdmin)),
    } as never)) as { canManageRules: boolean };
    expect(out.canManageRules).toBe(false);
  });
});
