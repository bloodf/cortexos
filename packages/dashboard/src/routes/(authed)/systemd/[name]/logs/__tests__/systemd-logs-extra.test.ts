/**
 * systemd-logs-extra.test.ts — additional coverage for
 * /(authed)/systemd/[name]/logs +server.ts.
 *
 * The existing `systemd-detail-page.test.ts` covers:
 *   - GET 401 (no auth)
 *   - POST 405
 *
 * Untested branches:
 *   - GET 403 (authenticated non-admin)
 *   - GET 400 (missing name)
 *   - GET 404 (unknown unit)
 *   - GET 200 with default limit
 *   - GET 200 with custom limit
 *   - GET 200 with limit clamped to MAX_LIMIT (500)
 *   - GET 200 with limit < 1 (falls back to default 100)
 *   - GET 200 with invalid limit (non-numeric, falls back to default 100)
 *   - PUT/PATCH/DELETE 405
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST, PUT, PATCH, DELETE } from '../+server';
import { _resetSystemdBridgeForTests } from '$lib/server/systemd/bridge';
import { _resetAllBuckets } from '$lib/server/rate-limit';
import { resetAudit } from '$lib/server/audit';
import { resetApprovalStore } from '$lib/server/approval';
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

beforeEach(() => {
  _resetSystemdBridgeForTests();
  _resetAllBuckets();
  resetAudit();
  resetApprovalStore();
  clearFakeAuth();
  setServerHmacKeyFromString('test-key-1234567890');
});

function adminEvent(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  params: Record<string, string> = { name: 'caddy.service' },
) {
  const user = makeFakeUser({
    is_admin: true,
    groupMemberships: [{ name: 'cortexos-admin', isAdmin: true }],
  });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return makeFakeEvent({
    method,
    url,
    locals: makeFakeLocals(user, session),
    params,
  });
}

function nonAdminEvent(url: string) {
  const user = makeFakeUser({ is_admin: false, groupMemberships: [] });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return makeFakeEvent({
    method: 'GET',
    url,
    locals: makeFakeLocals(user, session),
    params: { name: 'caddy.service' },
  });
}

describe('GET /systemd/[name]/logs', () => {
  it('returns 200 with default limit for a known unit (admin)', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('GET', 'http://localhost/systemd/caddy.service/logs'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      unit: string;
      limit: number;
      count: number;
      lines: Array<{ unit: string }>;
    };
    expect(body.unit).toBe('caddy.service');
    expect(body.limit).toBe(100);
    expect(body.count).toBe(body.lines.length);
  });

  it('honors a custom limit', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('GET', 'http://localhost/systemd/caddy.service/logs?limit=10'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { limit: number; count: number };
    expect(body.limit).toBe(10);
  });

  it('clamps a too-large limit to MAX_LIMIT (500)', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('GET', 'http://localhost/systemd/caddy.service/logs?limit=99999'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { limit: number };
    expect(body.limit).toBe(500);
  });

  it('falls back to default for a non-numeric limit', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('GET', 'http://localhost/systemd/caddy.service/logs?limit=abc'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { limit: number };
    expect(body.limit).toBe(100);
  });

  it('falls back to default for limit < 1', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('GET', 'http://localhost/systemd/caddy.service/logs?limit=0'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { limit: number };
    expect(body.limit).toBe(100);
  });

  it('returns 404 for an unknown unit (admin)', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent(
        'GET',
        'http://localhost/systemd/no-such-unit.service/logs',
        { name: 'no-such-unit.service' },
      ),
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 for a non-admin caller', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      nonAdminEvent('http://localhost/systemd/caddy.service/logs'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when the unit name is empty', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('GET', 'http://localhost/systemd//logs', { name: '' }),
    );
    expect(res.status).toBe(400);
  });
});

describe('non-GET methods on /systemd/[name]/logs', () => {
  it('PUT is 405', async () => {
    const res = await (PUT as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('PUT', 'http://localhost/systemd/caddy.service/logs'),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET');
  });

  it('PATCH is 405', async () => {
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('PATCH', 'http://localhost/systemd/caddy.service/logs'),
    );
    expect(res.status).toBe(405);
  });

  it('DELETE is 405', async () => {
    const res = await (DELETE as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('DELETE', 'http://localhost/systemd/caddy.service/logs'),
    );
    expect(res.status).toBe(405);
  });

  it('POST is 405', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('POST', 'http://localhost/systemd/caddy.service/logs'),
    );
    expect(res.status).toBe(405);
  });
});
