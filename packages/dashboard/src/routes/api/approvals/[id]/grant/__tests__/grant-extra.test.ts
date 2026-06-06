/**
 * approvals-grant-extra.test.ts — additional branches for
 * /api/approvals/[id]/grant beyond the existing happy-path test.
 *
 * Existing test in `__tests__/approvals-grant-revoke-api.test.ts`:
 *   - 401 (no auth), 403 (non-admin), 200 (admin happy), 404 (unknown id)
 *
 * Untested branches:
 *   - Token present but malformed (claimed === null) → 400
 *   - Token action-hash mismatch (claimed !== expected) → 400
 *   - Row already approved (decision === 'approve') → 400
 *   - Row already revoked (decision === 'deny') → 400
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { POST as grantPost } from '../+server';
import { _resetStubData, createPendingApproval } from '$lib/server/stub-data';
import { _resetAllBuckets } from '$lib/server/rate-limit';
import { resetApprovalStore, mintApproval } from '$lib/server/approval';
import { resetAudit } from '$lib/server/audit';
import { setServerHmacKeyFromString } from '$lib/server/config';
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
  setServerHmacKeyFromString('test-key-1234567890');
});

function adminEvent() {
  const user = makeFakeUser({
    is_admin: true,
    username: 'root',
    groupMemberships: ['cortexos-admin' as const],
  });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return makeFakeEvent({
    method: 'POST',
    url: 'http://localhost/api/approvals/x/grant',
    locals: makeFakeLocals(user, session),
  });
}

function eventWithParams(
  event: RequestEvent,
  params: Record<string, string>,
  body?: unknown,
): RequestEvent {
  const headers = new Headers({ 'content-type': 'application/json' });
  const csrf = event.request.headers.get('x-csrf-token');
  if (csrf) headers.set('x-csrf-token', csrf);
  return {
    ...event,
    params,
    request: new Request('http://localhost/api/approvals/x/grant', {
      method: 'POST',
      headers,
      body: body !== undefined ? JSON.stringify(body) : '{}',
    }),
  } as unknown as RequestEvent;
}

describe('POST /api/approvals/[id]/grant — extra branches', () => {
  it('returns 400 for a malformed token (claimed === null)', async () => {
    const row = createPendingApproval({
      runId: 'r1',
      signalName: 'service.restart',
      role: 'admin',
    });
    // 3-part token whose claims part is not valid base64url JSON.
    const res = await (grantPost as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(adminEvent(), { id: row.id }, { token: 'aaa.!!!.bbb' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for a token whose action-hash does not match', async () => {
    const row = createPendingApproval({
      runId: 'r2',
      signalName: 'service.restart',
      role: 'admin',
    });
    const user = makeFakeUser({ is_admin: true, username: 'root' });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const { token } = mintApproval({
      action: 'services.delete',
      payload: { op: 'services.delete', args: { service: 'x' } },
      sessionId: session.id,
      userId: user.id,
      ttlSec: 60,
    });
    const res = await (grantPost as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(adminEvent(), { id: row.id }, { token }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when granting an already-approved row', async () => {
    const row = createPendingApproval({
      runId: 'r4',
      signalName: 'service.restart',
    });
    const { resolvePendingApproval } = await import('$lib/server/stub-data');
    resolvePendingApproval(row.id, 'approve', 'someone');
    const res = await (grantPost as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(adminEvent(), { id: row.id }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when granting an already-denied row', async () => {
    const row = createPendingApproval({
      runId: 'r5',
      signalName: 'service.restart',
    });
    const { revokePendingApproval } = await import('$lib/server/stub-data');
    revokePendingApproval(row.id, 'someone');
    const res = await (grantPost as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(adminEvent(), { id: row.id }),
    );
    expect(res.status).toBe(400);
  });
});
