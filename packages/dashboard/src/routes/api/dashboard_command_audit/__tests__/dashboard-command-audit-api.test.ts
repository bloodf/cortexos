/**
 * dashboard-command-audit-api.test.ts — direct coverage of
 * /api/dashboard_command_audit (GET, POST, PATCH).
 *
 * Two-phase lifecycle (THREAT_MODEL §6.1 + SR-090):
 *   - POST → INSERT 'created' (admin, with approval gate for
 *     privileged commands).
 *   - PATCH → UPDATE 'finished' | 'failed' | 'cancelled' (admin,
 *     only allowed fields per SR-090).
 *
 * Untested paths in the original UI suite:
 *   - PATCH missing `id` query param → 404
 *   - PATCH against an unknown id → 404
 *   - PATCH advances with output / errorCode / finishedAt
 *   - PATCH validates the `status` enum
 *   - POST blocks privileged commands with the approval gate
 *   - POST with target / without target
 *   - 401 / 403 admin gate on both POST + PATCH
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST, PATCH } from '../+server';
import { _resetStubData } from '$lib/server/stub-data';
import { _resetAllBuckets } from '$lib/server/rate-limit';
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
  clearFakeAuth();
});

function adminEvent(url: string, method: 'GET' | 'POST' | 'PATCH', body?: unknown) {
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
    params: {},
    body,
  });
}

function authedEvent(method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown) {
  const user = makeFakeUser({ is_admin: false, groupMemberships: [] });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return makeFakeEvent({
    method,
    url,
    locals: makeFakeLocals(user, session),
    params: {},
    body,
  });
}

describe('GET /api/dashboard_command_audit', () => {
  it('returns the list (admin)', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/dashboard_command_audit', 'GET'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('returns 401 when no session is attached', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({
        method: 'GET',
        url: 'http://localhost/api/dashboard_command_audit',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin caller', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      authedEvent('GET', 'http://localhost/api/dashboard_command_audit'),
    );
    expect(res.status).toBe(403);
  });
});

describe('POST /api/dashboard_command_audit', () => {
  it('creates a non-privileged command audit (admin)', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/dashboard_command_audit', 'POST', {
        command: 'incus.ls',
        requestId: 'req-1',
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: { command: string; status: string; requestedBy: string } };
    expect(body.item.command).toBe('incus.ls');
    expect(body.item.status).toBe('created');
    expect(body.item.requestedBy).toBeTruthy();
  });

  it('creates with an explicit target (admin)', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/dashboard_command_audit', 'POST', {
        command: 'incus.ls',
        requestId: 'req-2',
        target: 'web-1',
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: { target: string | null } };
    expect(body.item.target).toBe('web-1');
  });

  it('surfaces an approval gate for a privileged command (systemd.*)', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/dashboard_command_audit', 'POST', {
        command: 'systemd.restart',
        requestId: 'req-3',
        target: 'caddy.service',
      }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('x-cortex-confirmation-token-required')).toBe('true');
  });

  it('surfaces an approval gate for incus.delete', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/dashboard_command_audit', 'POST', {
        command: 'incus.delete',
        requestId: 'req-4',
        target: 'web-1',
      }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('x-cortex-confirmation-token-required')).toBe('true');
  });

  it('rejects an empty command with 400', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/dashboard_command_audit', 'POST', {
        command: '',
        requestId: 'req-5',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 401 when no session is attached', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({
        method: 'POST',
        url: 'http://localhost/api/dashboard_command_audit',
        body: { command: 'incus.ls', requestId: 'req-6' },
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/dashboard_command_audit', () => {
  it('advances a created audit to running (admin)', async () => {
    const create = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/dashboard_command_audit', 'POST', {
        command: 'incus.ls',
        requestId: 'req-running',
      }),
    );
    const created = (await create.json()) as { item: { id: string } };

    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      adminEvent(
        'http://localhost/api/dashboard_command_audit?id=' + created.item.id,
        'PATCH',
        { status: 'running' },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: { status: string; finishedAt: string | null } };
    expect(body.item.status).toBe('running');
    // running does NOT set finishedAt per the two-phase model.
    expect(body.item.finishedAt).toBeNull();
  });

  it('advances to finished and sets finishedAt', async () => {
    const create = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/dashboard_command_audit', 'POST', {
        command: 'incus.ls',
        requestId: 'req-finished',
      }),
    );
    const created = (await create.json()) as { item: { id: string } };

    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      adminEvent(
        'http://localhost/api/dashboard_command_audit?id=' + created.item.id,
        'PATCH',
        { status: 'finished', output: 'ok' },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: { status: string; output: string; finishedAt: string | null } };
    expect(body.item.status).toBe('finished');
    expect(body.item.output).toBe('ok');
    expect(body.item.finishedAt).not.toBeNull();
  });

  it('advances to failed with errorCode', async () => {
    const create = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/dashboard_command_audit', 'POST', {
        command: 'incus.ls',
        requestId: 'req-failed',
      }),
    );
    const created = (await create.json()) as { item: { id: string } };

    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      adminEvent(
        'http://localhost/api/dashboard_command_audit?id=' + created.item.id,
        'PATCH',
        { status: 'failed', errorCode: 'TIMEOUT' },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: { status: string; errorCode: string } };
    expect(body.item.status).toBe('failed');
    expect(body.item.errorCode).toBe('TIMEOUT');
  });

  it('advances to cancelled', async () => {
    const create = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/dashboard_command_audit', 'POST', {
        command: 'incus.ls',
        requestId: 'req-cancelled',
      }),
    );
    const created = (await create.json()) as { item: { id: string } };

    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      adminEvent(
        'http://localhost/api/dashboard_command_audit?id=' + created.item.id,
        'PATCH',
        { status: 'cancelled' },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: { status: string; finishedAt: string | null } };
    expect(body.item.status).toBe('cancelled');
    expect(body.item.finishedAt).not.toBeNull();
  });

  it('returns 404 when the id query param is missing', async () => {
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/dashboard_command_audit', 'PATCH', {
        status: 'finished',
      }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 404 when the id is unknown', async () => {
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      adminEvent(
        'http://localhost/api/dashboard_command_audit?id=does-not-exist',
        'PATCH',
        { status: 'finished' },
      ),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid status enum', async () => {
    const create = await (POST as unknown as (e: unknown) => Promise<Response>)(
      adminEvent('http://localhost/api/dashboard_command_audit', 'POST', {
        command: 'incus.ls',
        requestId: 'req-bad-status',
      }),
    );
    const created = (await create.json()) as { item: { id: string } };

    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      adminEvent(
        'http://localhost/api/dashboard_command_audit?id=' + created.item.id,
        'PATCH',
        { status: 'not-a-real-status' },
      ),
    );
    expect(res.status).toBe(400);
  });

  it('returns 401 when no session is attached', async () => {
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({
        method: 'PATCH',
        url: 'http://localhost/api/dashboard_command_audit?id=foo',
        body: { status: 'finished' },
      }),
    );
    expect(res.status).toBe(401);
  });
});
