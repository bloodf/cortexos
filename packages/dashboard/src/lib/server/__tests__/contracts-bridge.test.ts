/**
 * contracts-bridge.test.ts — direct coverage of the bridge that
 * converts the local auth User/Session into the contracts shape
 * flowing through App.Locals.
 */
import { describe, it, expect } from 'vitest';
import { toContractsUser, toContractsSession } from '../contracts-bridge';
import {
  asUserId,
  asSessionId,
  type User as LocalUser,
  type Session as LocalSession,
} from '../entities';

const NOW = Date.parse('2026-06-04T19:00:00.000Z');

function makeLocalUser(over: Partial<LocalUser> = {}): LocalUser {
  return {
    id: asUserId('42'),
    username: over.username ?? 'testadmin',
    is_admin: over.isAdmin ?? true,
    isAdmin: over.isAdmin ?? true,
    isActive: over.isActive ?? true,
    groupMemberships: over.groupMemberships ?? [
      { name: 'cortexos-admin', isAdmin: true },
      { name: 'cortexos-users', isAdmin: false },
    ],
  };
}

function makeLocalSession(over: Partial<LocalSession> = {}): LocalSession {
  return {
    id: asSessionId('sess-1'),
    userId: asUserId('42'),
    csrfToken: over.csrfToken ?? 'csrf-token-32bytes-long-string',
    expiresAt: over.expiresAt ?? NOW + 30 * 24 * 60 * 60 * 1000,
    ua: over.ua ?? 'curl/8.5.0',
    ip: over.ip ?? '127.0.0.1',
    lastRoleCheckAt: over.lastRoleCheckAt ?? NOW,
  };
}

describe('toContractsUser', () => {
  it('produces a UUIDv4-shaped id derived from the integer', () => {
    const out = toContractsUser(makeLocalUser({ id: asUserId('1') }));
    expect(out.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('is deterministic for the same input id', () => {
    const a = toContractsUser(makeLocalUser({ id: asUserId('42') }));
    const b = toContractsUser(makeLocalUser({ id: asUserId('42') }));
    expect(a.id).toBe(b.id);
  });

  it('preserves username, isAdmin, isActive', () => {
    const out = toContractsUser(makeLocalUser());
    expect(out.username).toBe('testadmin');
    expect(out.isAdmin).toBe(true);
    expect(out.isActive).toBe(true);
  });

  it('marks status as "active" for the runtime user', () => {
    const out = toContractsUser(makeLocalUser());
    expect(out.status).toBe('active');
  });

  it('expands string-union groupMemberships into object form', () => {
    const local = makeLocalUser({
      groupMemberships: ['cortexos-admin', 'cortexos-users'],
    });
    const out = toContractsUser(local);
    expect(out.groupMemberships).toEqual([
      { name: 'cortexos-admin', description: expect.any(String), isAdmin: true },
      { name: 'cortexos-users', description: expect.any(String), isAdmin: false },
    ]);
  });

  it('marks only cortexos-admin as isAdmin:true', () => {
    const local = makeLocalUser({
      groupMemberships: ['cortexos-admin', 'cortexos-users', 'cortexos-auditor'],
      isAdmin: true,
    });
    const out = toContractsUser(local);
    const adminEntry = out.groupMemberships.find((g) => g.name === 'cortexos-admin');
    const usersEntry = out.groupMemberships.find((g) => g.name === 'cortexos-users');
    const auditorEntry = out.groupMemberships.find((g) => g.name === 'cortexos-auditor');
    expect(adminEntry?.isAdmin).toBe(true);
    expect(usersEntry?.isAdmin).toBe(false);
    expect(auditorEntry?.isAdmin).toBe(false);
  });

  it('sets isAdmin on the per-group entry to false for a non-admin user', () => {
    const local = makeLocalUser({
      isAdmin: false,
      groupMemberships: [{ name: 'cortexos-admin', isAdmin: false }, { name: 'cortexos-users', isAdmin: false }],
    });
    const out = toContractsUser(local);
    const adminEntry = out.groupMemberships.find((g) => g.name === 'cortexos-admin');
    expect(adminEntry?.isAdmin).toBe(false);
  });

  it('populates activeSessions from the optional count', () => {
    expect(toContractsUser(makeLocalUser(), 0).activeSessions).toBe(0);
    expect(toContractsUser(makeLocalUser(), 5).activeSessions).toBe(5);
    expect(toContractsUser(makeLocalUser()).activeSessions).toBe(1);
  });

  it('sets lastLoginAt to null (auth store does not track it)', () => {
    const out = toContractsUser(makeLocalUser());
    expect(out.lastLoginAt).toBeNull();
  });
});

describe('toContractsSession', () => {
  it('produces a UUIDv4-shaped id', () => {
    const out = toContractsSession(makeLocalSession({ id: asSessionId('sess-1') }));
    expect(out.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('maps the cookieToken to the same value as csrfToken (paired cookies)', () => {
    const out = toContractsSession(makeLocalSession({ csrfToken: 'abc123token' }));
    expect(out.cookieToken).toBe('abc123token');
    expect(out.csrfToken).toBe('abc123token');
  });

  it('converts epoch ms fields to ISO 8601', () => {
    const out = toContractsSession(makeLocalSession({
      expiresAt: NOW + 30 * 24 * 60 * 60 * 1000,
      lastRoleCheckAt: NOW,
    }));
    expect(out.expiresAt).toBe(new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString());
    expect(out.lastSeenAt).toBe(new Date(NOW).toISOString());
    expect(out.lastRoleCheck).toBe(NOW);
  });

  it('preserves ip and userAgent', () => {
    const out = toContractsSession(makeLocalSession({
      ip: '10.0.0.1',
      ua: 'Cortex/1.0',
    }));
    expect(out.ip).toBe('10.0.0.1');
    expect(out.userAgent).toBe('Cortex/1.0');
  });

  it('preserves nullable ip and userAgent', () => {
    // Make sure to override the makeLocalSession defaults.
    const out = toContractsSession({
      id: asSessionId('sess-x'),
      userId: asUserId('42'),
      csrfToken: 'csrf-token-32bytes-long-string',
      expiresAt: NOW + 30 * 24 * 60 * 60 * 1000,
      ua: null,
      ip: null,
      lastRoleCheckAt: NOW,
    });
    expect(out.ip).toBeNull();
    expect(out.userAgent).toBeNull();
  });

  it('computes createdAt as expiresAt minus 30-day default TTL', () => {
    const out = toContractsSession(makeLocalSession({ expiresAt: NOW + 30 * 24 * 60 * 60 * 1000 }));
    const expectedCreated = NOW + 30 * 24 * 60 * 60 * 1000 - 30 * 24 * 60 * 60 * 1000;
    expect(out.createdAt).toBe(new Date(expectedCreated).toISOString());
  });
});
