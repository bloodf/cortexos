/**
 * approvals-api.test.ts — direct coverage of /api/approvals
 * (GET, POST, DELETE).
 *
 * The existing `approvals-grant-revoke-api.test.ts` covers
 * `/api/approvals/[id]/{grant,revoke}` end-to-end. This file
 * exercises the MINT endpoint (`POST /api/approvals`) — admin gate,
 * payload validation, ttl defaults, and the `reveal.*` override.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST, DELETE } from '../+server';
import { _resetStubData } from '$lib/server/stub-data';
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

beforeEach(() => {
  _resetStubData();
  _resetAllBuckets();
  resetApprovalStore();
  resetAudit();
  clearFakeAuth();
});

function adminEvent(url: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown) {
  const user = makeFakeUser({
    is_admin: true,
    groupMemberships: ['cortexos-admin' as const],
  });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return makeFakeEvent({
    method,
    url,
    locals: makeFakeLocals(user, session),
    body,
  });
}

function authedEvent(url: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown) {
  const user = makeFakeUser({ is_admin: false, groupMemberships: [] });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return makeFakeEvent({
    method,
    url,
    locals: makeFakeLocals(user, session),
    body,
  });
}

describe('GET /api/approvals', () => {
  it('returns the (empty) pending list (admin)', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/approvals', 'GET'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pending: unknown[] };
    expect(Array.isArray(body.pending)).toBe(true);
  });

  it('returns 401 when no session is attached', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({ method: 'GET', url: 'http://localhost/api/approvals' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin caller (PB-1)', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      authedEvent('http://localhost/api/approvals', 'GET'),
    );
    expect(res.status).toBe(403);
  });
});

describe('POST /api/approvals — mint (PB-1)', () => {
  it('mints a token for a non-reveal action (admin)', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/approvals', 'POST', {
        action: 'services.restart',
        payload: { foo: 'bar' },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      token: string;
      ttlSec: number;
      actionHash: string;
      issuedAt: string;
      expiresAt: string;
    };
    expect(typeof body.token).toBe('string');
    expect(body.token.split('.').length).toBe(3);
    // Default ttl is 60s for non-reveal actions.
    expect(body.ttlSec).toBe(60);
  });

  it('uses a 300s default ttl for reveal.* actions', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/approvals', 'POST', {
        action: 'reveal.secret',
        payload: {},
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ttlSec: number };
    expect(body.ttlSec).toBe(300);
  });

  it('honors a caller-provided ttlSec within bounds', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/approvals', 'POST', {
        action: 'services.restart',
        payload: {},
        ttlSec: 120,
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ttlSec: number };
    expect(body.ttlSec).toBe(120);
  });

  it('rejects a ttlSec above the max with 400', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/approvals', 'POST', {
        action: 'services.restart',
        payload: {},
        ttlSec: 99999,
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects an empty action with 400', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/approvals', 'POST', {
        action: '',
        payload: {},
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 401 when no session is attached', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({
        method: 'POST',
        url: 'http://localhost/api/approvals',
        body: { action: 'services.restart', payload: {} },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin caller (PB-1)', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      authedEvent('http://localhost/api/approvals', 'POST', {
        action: 'services.restart',
        payload: {},
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/approvals', () => {
  it('returns success (admin)', async () => {
    const res = await (DELETE as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/approvals?id=anything', 'DELETE'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 403 for a non-admin caller', async () => {
    const res = await (DELETE as unknown as (e: unknown) => Promise<Response>)(
      authedEvent('http://localhost/api/approvals?id=x', 'DELETE'),
    );
    expect(res.status).toBe(403);
  });
});
