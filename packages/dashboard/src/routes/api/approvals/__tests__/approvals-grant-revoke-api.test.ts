/**
 * approvals-grant-revoke-api.test.ts — PB-1 retest for the M2
 * approvals feature.
 *
 * Verifies that:
 *   - POST /api/approvals/[id]/grant returns 401 for an
 *     unauthenticated request (no session).
 *   - POST /api/approvals/[id]/grant returns 403 for an
 *     authenticated non-admin (real session, real groups).
 *   - POST /api/approvals/[id]/grant returns 200 for an
 *     authenticated admin, and marks the row as approved.
 *   - POST /api/approvals/[id]/revoke invalidates the row
 *     (decision='deny', approver=admin username, resolvedAt=now).
 *
 * These mirror the M0-B finding (PB-1) and the M2-WS3 retest in
 * `__tests__/auth-m2.test.ts`. We repeat them against the
 * `[id]/grant` and `[id]/revoke` endpoints so the verifier can
 * confirm the M2-WS4 routes go through the real requireAdmin.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FakePamAuthenticator,
  InMemorySessionStore,
  setPamAuthenticator,
  setSessionStore,
  resetPamAuthenticator,
  resetSessionStore,
} from '$lib/server/auth';
import {
  _resetStubData,
  createPendingApproval,
  getPendingApproval,
} from '$lib/server/stub-data';
import {
  makeFakeEvent,
  makeFakeLocals,
} from '$lib/server/test-utils';
import { POST as grantPost } from '../[id]/grant/+server';
import { POST as revokePost } from '../[id]/revoke/+server';
import type { RequestEvent } from '$lib/server/types';

function eventWithParams(event: RequestEvent, params: Record<string, string>): RequestEvent {
  return { ...event, params } as unknown as RequestEvent;
}

beforeEach(() => {
  _resetStubData();
  setSessionStore(new InMemorySessionStore());
  setPamAuthenticator(new FakePamAuthenticator());
});

afterEach(() => {
  resetPamAuthenticator();
  resetSessionStore();
});

describe('PB-1 retest: /api/approvals/[id]/grant', () => {
  it('returns 401 for an unauthenticated request (no session)', async () => {
    const row = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const event = makeFakeEvent({ method: 'POST' });
    const res = await grantPost(eventWithParams(event, { id: row.id }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for an authenticated non-admin (real session, real groups)', async () => {
    const pam = new FakePamAuthenticator();
    pam.setFakeUser({ username: 'bob', password: 'pw', groups: ['cortexos-users'] });
    setPamAuthenticator(pam);
    const store = new InMemorySessionStore();
    const created = await store.createSession({
      username: 'bob',
      csrfToken: 'csrf-bob',
      ip: '127.0.0.1',
      userAgent: 'ua',
      isAdmin: false,
    });
    setSessionStore(store);

    const row = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const event = makeFakeEvent({
      method: 'POST',
      locals: makeFakeLocals(created.user, created.session),
    });
    const res = await grantPost(eventWithParams(event, { id: row.id }));
    expect(res.status).toBe(403);
  });

  it('returns 200 for an authenticated admin (real session, real groups)', async () => {
    const pam = new FakePamAuthenticator();
    pam.setFakeUser({ username: 'root', password: 'pw', groups: ['cortexos-admin'] });
    setPamAuthenticator(pam);
    const store = new InMemorySessionStore();
    const created = await store.createSession({
      username: 'root',
      csrfToken: 'csrf-root',
      ip: '127.0.0.1',
      userAgent: 'ua',
      isAdmin: true,
    });
    setSessionStore(store);

    const row = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const event = makeFakeEvent({
      method: 'POST',
      locals: makeFakeLocals(created.user, created.session),
    });
    const res = await grantPost(eventWithParams(event, { id: row.id }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { decision: string; approver: string };
    expect(body.decision).toBe('approve');
    expect(body.approver).toBe('root');

    // The DB row must be marked as approved.
    const updated = getPendingApproval(row.id);
    expect(updated?.decision).toBe('approve');
    expect(updated?.approver).toBe('root');
    expect(updated?.resolvedAt).not.toBeNull();
  });

  it('returns 404 for an unknown approval id (admin caller)', async () => {
    const pam = new FakePamAuthenticator();
    pam.setFakeUser({ username: 'root', password: 'pw', groups: ['cortexos-admin'] });
    setPamAuthenticator(pam);
    const store = new InMemorySessionStore();
    const created = await store.createSession({
      username: 'root',
      csrfToken: 'csrf-root',
      ip: '127.0.0.1',
      userAgent: 'ua',
      isAdmin: true,
    });
    setSessionStore(store);

    const event = makeFakeEvent({
      method: 'POST',
      locals: makeFakeLocals(created.user, created.session),
    });
    const res = await grantPost(eventWithParams(event, { id: 'appr_does_not_exist' }));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/approvals/[id]/revoke', () => {
  it('returns 401 for an unauthenticated request (no session)', async () => {
    const row = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const event = makeFakeEvent({ method: 'POST' });
    const res = await revokePost(eventWithParams(event, { id: row.id }));
    expect(res.status).toBe(401);
  });

  it('returns 200 for an authenticated admin and marks the row as denied', async () => {
    const pam = new FakePamAuthenticator();
    pam.setFakeUser({ username: 'root', password: 'pw', groups: ['cortexos-admin'] });
    setPamAuthenticator(pam);
    const store = new InMemorySessionStore();
    const created = await store.createSession({
      username: 'root',
      csrfToken: 'csrf-root',
      ip: '127.0.0.1',
      userAgent: 'ua',
      isAdmin: true,
    });
    setSessionStore(store);

    const row = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const event = makeFakeEvent({
      method: 'POST',
      locals: makeFakeLocals(created.user, created.session),
    });
    const res = await revokePost(eventWithParams(event, { id: row.id }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { decision: string; approver: string };
    expect(body.decision).toBe('deny');
    expect(body.approver).toBe('root');

    // The DB row must be invalidated (decision='deny', resolvedAt set).
    const updated = getPendingApproval(row.id);
    expect(updated?.decision).toBe('deny');
    expect(updated?.approver).toBe('root');
    expect(updated?.resolvedAt).not.toBeNull();
  });
});
