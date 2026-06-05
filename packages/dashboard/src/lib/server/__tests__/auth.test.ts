/**
 * auth.test.ts — 5+ tests for `requireAuth`, `requireAdmin`, `requireGroup`.
 *
 * Covers:
 *   - Unauthenticated request → 401 (via `apiError` throw)
 *   - Authenticated non-admin → 403 on requireAdmin
 *   - Authenticated admin → user returned
 *   - Group membership check
 *   - Inactive user → 401
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  requireAuth,
  requireAdmin,
  requireGroup,
  isAdmin,
  hasGroup,
  registerFakeUser,
  registerFakeSession,
  clearFakeAuth,
  getSessionStore,
  InMemorySessionStore,
  setSessionStore,
} from '../auth';
import {
  ApiErrorThrown,
} from '../errors';
import { setServerHmacKeyFromString } from '../config';
import { makeFakeEvent, makeFakeUser, makeFakeSession, makeFakeLocals } from '../test-utils';
import { asUserId, asSessionId } from '../entities';

beforeEach(() => {
  clearFakeAuth();
  setServerHmacKeyFromString('test-key-1234567890');
});

describe('requireAuth', () => {
  it('throws 401 when no user is present', () => {
    const event = makeFakeEvent();
    expect(() => requireAuth(event)).toThrow(ApiErrorThrown);
    try {
      requireAuth(event);
    } catch (e) {
      expect((e as ApiErrorThrown).status).toBe(401);
    }
  });

  it('returns the user when locals has one', () => {
    const user = makeFakeUser({ username: 'alice' });
    const session = makeFakeSession(user);
    const event = makeFakeEvent({ locals: makeFakeLocals(user, session) });
    const got = requireAuth(event);
    expect(got.id).toBe(user.id);
    expect(got.username).toBe('alice');
  });

  it('returns user resolved from session cookie', async () => {
    // Use the new session store API: create a real session and use
    // its token as the cookie value. The hook populates locals
    // from the resolved session — simulate that here so the
    // synchronous `requireAuth` path picks it up.
    const user = makeFakeUser({ username: 'bob' });
    const store = getSessionStore() as InMemorySessionStore;
    store.upsertUser({
      username: user.username,
      groupMemberships: user.groupMemberships.map((g) =>
        typeof g === 'string' ? g : g.name,
      ),
    });
    const created = await store.createSession({
      username: user.username,
      csrfToken: 'csrf-test-bob',
      ip: '127.0.0.1',
      userAgent: 'test-ua/1.0',
      isAdmin: user.is_admin,
    });
    const event = makeFakeEvent({
      cookies: { cortexos_session: created.token },
      locals: makeFakeLocals(created.user, created.session),
    });
    const got = requireAuth(event);
    expect(got.id).toBe(created.user.id);
    expect(got.username).toBe(user.username);
  });

  it('throws 401 for an inactive user', () => {
    const user = makeFakeUser({ isActive: false });
    const session = makeFakeSession(user);
    const event = makeFakeEvent({ locals: makeFakeLocals(user, session) });
    expect(() => requireAuth(event)).toThrow(ApiErrorThrown);
    try {
      requireAuth(event);
    } catch (e) {
      expect((e as ApiErrorThrown).status).toBe(401);
    }
  });
});

describe('requireAdmin', () => {
  it('returns admin user', () => {
    const user = makeFakeUser({ is_admin: true, groupMemberships: ['cortexos-admin'] });
    const session = makeFakeSession(user);
    const event = makeFakeEvent({ locals: makeFakeLocals(user, session) });
    const got = requireAdmin(event);
    expect(got.id).toBe(user.id);
  });

  it('throws 403 for authenticated non-admin', () => {
    const user = makeFakeUser({ is_admin: false, groupMemberships: [] });
    const session = makeFakeSession(user);
    const event = makeFakeEvent({ locals: makeFakeLocals(user, session) });
    expect(() => requireAdmin(event)).toThrow(ApiErrorThrown);
    try {
      requireAdmin(event);
    } catch (e) {
      expect((e as ApiErrorThrown).status).toBe(403);
    }
  });

  it('throws 401 for unauthenticated', () => {
    const event = makeFakeEvent();
    expect(() => requireAdmin(event)).toThrow(ApiErrorThrown);
    try {
      requireAdmin(event);
    } catch (e) {
      expect((e as ApiErrorThrown).status).toBe(401);
    }
  });

  it('isAdmin returns true for cortexos-admin member (SR-003)', () => {
    const user = makeFakeUser({ is_admin: true, groupMemberships: ['cortexos-admin'] });
    expect(isAdmin(user)).toBe(true);
  });

  it('isAdmin returns true when is_admin flag is set even without group (legacy)', () => {
    const user = makeFakeUser({ is_admin: true, groupMemberships: [] });
    expect(isAdmin(user)).toBe(true);
  });
});

describe('requireGroup', () => {
  it('returns user when in the required group', () => {
    const user = makeFakeUser({ groupMemberships: ['cortexos-auditor'] });
    const session = makeFakeSession(user);
    const event = makeFakeEvent({ locals: makeFakeLocals(user, session) });
    const got = requireGroup(event, 'cortexos-auditor');
    expect(got.id).toBe(user.id);
  });

  it('throws 403 when not in the required group', () => {
    const user = makeFakeUser({ groupMemberships: ['cortexos-users'] });
    const session = makeFakeSession(user);
    const event = makeFakeEvent({ locals: makeFakeLocals(user, session) });
    expect(() => requireGroup(event, 'cortexos-auditor')).toThrow(ApiErrorThrown);
    try {
      requireGroup(event, 'cortexos-auditor');
    } catch (e) {
      expect((e as ApiErrorThrown).status).toBe(403);
    }
  });

  it('hasGroup predicate', () => {
    const user = makeFakeUser({ groupMemberships: ['cortexos-admin', 'cortexos-users'] });
    expect(hasGroup(user, 'cortexos-admin')).toBe(true);
    expect(hasGroup(user, 'cortexos-auditor')).toBe(false);
  });
});

describe('PB-1 fix verification (M0-B finding)', () => {
  it('non-admin user cannot pass the approvals admin gate', () => {
    // The /api/approvals POST handler uses requireAdmin. We simulate
    // a non-admin user hitting the endpoint.
    const user = makeFakeUser({ is_admin: false, groupMemberships: [] });
    const session = makeFakeSession(user);
    const event = makeFakeEvent({ locals: makeFakeLocals(user, session) });
    expect(() => requireAdmin(event)).toThrow(ApiErrorThrown);
  });
});
