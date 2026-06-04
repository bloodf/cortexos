/**
 * approvals-revoke-extra.test.ts — additional coverage for
 * /api/approvals/[id]/revoke beyond the existing happy-path test.
 *
 * The existing test covers: 401 (no auth), 200 (admin happy path,
 * marks row as denied). Untested branches:
 *   - 404 for an unknown approval id
 *   - 400 when revoking an already-resolved row (decision != null)
 *   - 400 when revoking an already-approved row (decision === 'approve')
 *   - 403 for a non-admin caller
 *   - 405 for non-POST methods
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { POST as revokePost } from '../+server';
import { _resetStubData, createPendingApproval } from '$lib/server/stub-data';
import { _resetAllBuckets } from '$lib/server/rate-limit';
import { resetApprovalStore } from '$lib/server/approval';
import { resetAudit } from '$lib/server/audit';
import {
  makeFakeEvent,
  makeFakeUser,
  makeFakeSession,
  makeFakeLocals,
} from '$lib/server/test-utils';
import {
  registerFakeUser,
  registerFakeSession,
  clearFakeAuth,
} from '$lib/server/auth';
import type { RequestEvent } from '$lib/server/types';

beforeEach(() => {
  _resetStubData();
  _resetAllBuckets();
  resetApprovalStore();
  resetAudit();
  clearFakeAuth();
});

function adminEvent(method: 'POST' | 'GET') {
  const user = makeFakeUser({
    is_admin: true,
    groupMemberships: ['cortexos-admin' as const],
  });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return makeFakeEvent({
    method,
    url: 'http://localhost/api/approvals/x/revoke',
    locals: makeFakeLocals(user, session),
  });
}

function eventWithParams(event: RequestEvent, params: Record<string, string>): RequestEvent {
  return { ...event, params } as unknown as RequestEvent;
}

describe('POST /api/approvals/[id]/revoke — extra branches', () => {
  it('returns 404 for an unknown approval id (admin)', async () => {
    const res = await (revokePost as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(adminEvent('POST'), { id: 'nope' }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 for a non-admin caller', async () => {
    const user = makeFakeUser({ is_admin: false, groupMemberships: [] });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const event = makeFakeEvent({
      method: 'POST',
      url: 'http://localhost/api/approvals/x/revoke',
      locals: makeFakeLocals(user, session),
    });
    const res = await (revokePost as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(event, { id: 'x' }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when revoking an already-resolved row (decision=deny)', async () => {
    const row = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    // First revoke
    const first = await (revokePost as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(adminEvent('POST'), { id: row.id }),
    );
    expect(first.status).toBe(200);
    // Second revoke on the now-denied row
    const second = await (revokePost as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(adminEvent('POST'), { id: row.id }),
    );
    expect(second.status).toBe(400);
  });

  it('returns 400 when revoking an already-approved row (decision=approve)', async () => {
    const row = createPendingApproval({ runId: 'r2', signalName: 'service.restart' });
    // Resolve as approved directly via stub-data
    const { resolvePendingApproval } = await import('$lib/server/stub-data');
    resolvePendingApproval(row.id, 'approve', 'somebody');
    // Now try to revoke
    const res = await (revokePost as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(adminEvent('POST'), { id: row.id }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 401 for a request with no session', async () => {
    const event = makeFakeEvent({
      method: 'POST',
      url: 'http://localhost/api/approvals/x/revoke',
    });
    const res = await (revokePost as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(event, { id: 'x' }),
    );
    expect(res.status).toBe(401);
  });
});
