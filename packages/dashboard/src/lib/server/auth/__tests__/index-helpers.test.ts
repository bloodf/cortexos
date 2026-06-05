/**
 * auth-index-helpers.test.ts — coverage of the `isAdmin` + `hasGroup`
 * + `getCurrentSession` paths in lib/server/auth/index.ts that the
 * existing auth-m2.test.ts does not exercise.
 *
 * Targets: `isAdmin` early-return for `isAdmin: true`,
 * `isAdmin` for `is_admin: true` legacy, fallback to
 * `groupMemberships` string union, fallback to
 * `groupMemberships` object form.
 */
import { describe, it, expect } from 'vitest';
import { isAdmin, hasGroup } from '../index';
import { makeFakeUser, makeFakeSession } from '../../test-utils';

describe('isAdmin — every path', () => {
  it('returns true when isAdmin=true', () => {
    const u = makeFakeUser({ isAdmin: true });
    expect(isAdmin(u)).toBe(true);
  });

  it('returns true when legacy is_admin=true (even with isAdmin=false)', () => {
    // makeFakeUser normalises isAdmin and is_admin together; we
    // bypass it here to construct the legacy shape directly.
    const u = {
      id: 'user_legacy' as never,
      username: 'legacy',
      isAdmin: false,
      is_admin: true,
      isActive: true,
      groupMemberships: [{ name: 'cortexos-users', isAdmin: false, description: '' }],
    } as never;
    expect(isAdmin(u)).toBe(true);
  });

  it('returns true when groupMemberships contains cortexos-admin (string union)', () => {
    const u = makeFakeUser({
      isAdmin: false,
      is_admin: false,
      groupMemberships: ['cortexos-admin'],
    });
    expect(isAdmin(u)).toBe(true);
  });

  it('returns true when groupMemberships contains cortexos-admin (object form)', () => {
    const u = makeFakeUser({
      isAdmin: false,
      is_admin: false,
      groupMemberships: [{ name: 'cortexos-admin', isAdmin: true, description: '' }],
    });
    expect(isAdmin(u)).toBe(true);
  });

  it('returns false when no admin signal is present', () => {
    const u = makeFakeUser({
      isAdmin: false,
      is_admin: false,
      groupMemberships: ['cortexos-users'],
    });
    expect(isAdmin(u)).toBe(false);
  });

  it('returns false when groupMemberships is empty', () => {
    const u = makeFakeUser({
      isAdmin: false,
      is_admin: false,
      groupMemberships: [],
    });
    expect(isAdmin(u)).toBe(false);
  });
});

describe('hasGroup — string and object forms', () => {
  it('matches a string-union membership', () => {
    const u = makeFakeUser({ groupMemberships: ['cortexos-auditor'] });
    expect(hasGroup(u, 'cortexos-auditor')).toBe(true);
  });

  it('matches an object-form membership by name', () => {
    const u = makeFakeUser({
      groupMemberships: [{ name: 'cortexos-auditor', isAdmin: false, description: '' }],
    });
    expect(hasGroup(u, 'cortexos-auditor')).toBe(true);
  });

  it('returns false for a missing group', () => {
    const u = makeFakeUser({ groupMemberships: ['cortexos-users'] });
    expect(hasGroup(u, 'cortexos-admin')).toBe(false);
  });
});

describe('getCurrentSession — local + cookie paths', () => {
  it('returns null when there is no session and no cookie', async () => {
    const { getCurrentSession } = await import('../index');
    const event = {
      locals: {},
      cookies: { get: () => undefined },
    } as never;
    const r = await getCurrentSession(event);
    expect(r).toBeNull();
  });

  it('returns the locals session when both locals are set', async () => {
    const { getCurrentSession } = await import('../index');
    const user = makeFakeUser({ isAdmin: true });
    const session = makeFakeSession(user);
    const event = {
      locals: { user, session },
      cookies: { get: () => undefined },
    } as never;
    const r = await getCurrentSession(event);
    expect(r).not.toBeNull();
    expect(r!.user.id).toBe(user.id);
    expect(r!.isAdmin).toBe(true);
  });
});
