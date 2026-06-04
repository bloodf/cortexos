/**
 * audit-api.test.ts — direct coverage of /api/audit (PB-1 read gate +
 * filter combination matrix).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { asUserId } from '$lib/server/entities';
import { GET } from '../+server';
import { resetAudit, audit } from '$lib/server/audit';
import { _resetAllBuckets } from '$lib/server/rate-limit';
import { _resetStubData } from '$lib/server/stub-data';
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
import type { AuditInput } from '$lib/server/audit';

beforeEach(() => {
  resetAudit();
  _resetStubData();
  _resetAllBuckets();
  clearFakeAuth();
});

function adminEvent(url: string) {
  const user = makeFakeUser({
    is_admin: true,
    groupMemberships: ['cortexos-admin' as const],
  });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return makeFakeEvent({ method: 'GET', url, locals: makeFakeLocals(user, session) });
}

function makeAudit(partial: Partial<AuditInput>): AuditInput {
  return {
    surface: 'test',
    action: 'test.action',
    actorUserId: null,
    actorSessionId: null,
    actorIp: null,
    actorUserAgent: null,
    target: null,
    result: 'success',
    errorCode: null,
    payload: {},
    ...partial,
  };
}

/** Seed the audit store with a known mix of events. */
function seedMixedAudit() {
  audit(makeAudit({ surface: 'approvals', action: 'approvals.list', actorUserId: asUserId('user-alice'), result: 'success' }));
  audit(makeAudit({ surface: 'approvals', action: 'approvals.grant', actorUserId: asUserId('user-alice'), result: 'denied' }));
  audit(makeAudit({ surface: 'audit', action: 'audit.list', actorUserId: asUserId('user-bob'), result: 'success' }));
  audit(makeAudit({ surface: 'systemd', action: 'systemd.restart', actorUserId: asUserId('user-alice'), result: 'failure' }));
  audit(makeAudit({ surface: 'audit', action: 'audit.export', actorUserId: asUserId('user-carol'), result: 'success' }));
  for (let i = 0; i < 25; i++) {
    audit(makeAudit({ surface: 'approvals', action: 'approvals.list', actorUserId: asUserId(`user-${i}`), result: 'success' }));
  }
}

describe('GET /api/audit', () => {
  beforeEach(() => {
    seedMixedAudit();
  });

  it('returns the empty shape when no events match', async () => {
    resetAudit();
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/audit'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number };
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('filters by actor', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/audit?actor=user-carol'),
    );
    const body = (await res.json()) as { items: Array<{ actorUserId: string; surface: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.items[0]?.actorUserId).toBe('user-carol');
  });

  it('filters by surface', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/audit?surface=approvals'),
    );
    const body = (await res.json()) as { items: Array<{ surface: string }>; total: number };
    expect(body.total).toBeGreaterThan(1);
    for (const e of body.items) expect(e.surface).toBe('approvals');
  });

  it('filters by result=denied', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/audit?result=denied'),
    );
    const body = (await res.json()) as { items: Array<{ result: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.items[0]?.result).toBe('denied');
  });

  it('honors limit + offset pagination', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/audit?limit=10&offset=0'),
    );
    const body = (await res.json()) as { items: Array<unknown>; total: number };
    expect(body.items.length).toBe(10);
    expect(body.total).toBeGreaterThan(10);
  });

  it('returns 401 for anonymous', async () => {
    const user = makeFakeUser({ is_admin: false, groupMemberships: [] });
    const session = makeFakeSession(user);
    clearFakeAuth();
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({ method: 'GET', url: 'http://localhost/api/audit', locals: makeFakeLocals(user, session) }),
    );
    expect([401, 403]).toContain(res.status);
  });
});
