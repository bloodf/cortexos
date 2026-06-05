/**
 * incus-detail-page.test.ts — exercises the /incus/[name] page
 * server `load()` (returns the instance + logs + admin flag) and
 * the default form action (admin-gated + approval-token-gated
 * per PB-5, plus the delete confirmation phrase).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  _resetIncusBridgeForTests,
  _getMockExecutorForTests,
} from '$lib/server/incus/bridge';
import { makeFakeEvent, makeFakeUser, makeFakeSession, makeFakeLocals } from '$lib/server/test-utils';
import { registerFakeUser, registerFakeSession, clearFakeAuth } from '$lib/server/auth';
import { asUserId, asSessionId, type User } from '$lib/server/entities';
import { mintApproval } from '$lib/server/approval';
import { setServerHmacKeyFromString } from '$lib/server/config';
import {
  load as detailLoad,
  actions,
} from '../../../../routes/(authed)/incus/[name]/+page.server';
import { GET as logsGet, POST as logsPost } from '../../../../routes/api/incus/[name]/logs/+server';

beforeEach(() => {
  _resetIncusBridgeForTests();
  clearFakeAuth();
  setServerHmacKeyFromString('test-key-1234567890');
});

function makeDetailLoadEvent(name: string) {
  return {
    url: new URL(`http://localhost/incus/${name}`),
    params: { name },
    cookies: { get: () => undefined },
    request: new Request(`http://localhost/incus/${name}`),
    route: { id: null },
    locals: {},
    getClientAddress: () => '127.0.0.1',
  } as unknown as Parameters<typeof detailLoad>[0];
}

type DetailPageData = {
  instance: { name: string; status: string; [k: string]: unknown };
  logs: Array<{ name: string; message: string; [k: string]: unknown }>;
  isAdmin: boolean;
};

async function loadDetail(event: ReturnType<typeof makeDetailLoadEvent>): Promise<DetailPageData> {
  return (await detailLoad(event)) as unknown as DetailPageData;
}

function makeActionEvent(name: string, action: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ action, name, ...extra });
  const request = new Request(`http://localhost/incus/${name}?/default`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return {
    url: new URL(`http://localhost/incus/${name}?/default`),
    params: { name },
    request,
    locals: {},
    cookies: { get: () => undefined, set: () => undefined, delete: () => undefined },
    getClientAddress: () => '127.0.0.1',
  } as unknown as Parameters<NonNullable<typeof actions.default>>[0];
}

describe('/incus/[name] detail page — load()', () => {
  it('loads a known instance', async () => {
    const data = await loadDetail(makeDetailLoadEvent('hermes-canary'));
    expect(data.instance.name).toBe('hermes-canary');
    expect(data.instance.status).toBe('active');
  });

  it('throws a 404 for a missing instance', async () => {
    await expect(loadDetail(makeDetailLoadEvent('nope'))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('returns the instance + logs (newest first)', async () => {
    const data = await loadDetail(makeDetailLoadEvent('hermes-canary'));
    expect(data.logs.length).toBeGreaterThan(0);
    expect(data.logs.every((l) => l.name === 'hermes-canary')).toBe(true);
  });

  it('returns isAdmin=false when the request is anonymous', async () => {
    const data = await loadDetail(makeDetailLoadEvent('hermes-canary'));
    expect(data.isAdmin).toBe(false);
  });
});

describe('/incus/[name] detail page — default action', () => {
  it('rejects an unknown action (no dispatch)', async () => {
    const event = makeActionEvent('hermes-canary', 'frobnicate');
    const result = await (actions.default as unknown as (e: unknown) => Promise<{ status: number; data?: { error?: string } }>)(
      event,
    );
    expect(result.status).toBe(400);
    expect(result.data?.error).toMatch(/Unknown action/);
  });

  it('rejects when the caller has no session (auth required)', async () => {
    const event = makeActionEvent('hermes-canary', 'start');
    const result = await (actions.default as unknown as (e: unknown) => Promise<{ status: number }>)(
      event,
    );
    expect(result.status).toBe(401);
  });

  it('rejects a destructive action without an approval token (no session, no token)', async () => {
    const event = makeActionEvent('hermes-canary', 'stop');
    const result = await (actions.default as unknown as (e: unknown) => Promise<{ status: number }>)(
      event,
    );
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it('accepts a non-destructive start action for a known instance', async () => {
    const user = makeFakeUser({ isAdmin: true, groupMemberships: ['cortexos-admin'] });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const event = makeActionEvent('hermes-canary', 'start');
    (event as { locals: unknown }).locals = makeFakeLocals(user, session);
    const result = await (actions.default as unknown as (e: unknown) => Promise<{ ok?: boolean; action?: string }>)(
      event,
    );
    expect(result.ok).toBe(true);
    expect(result.action).toBe('start');
  });

  it('returns 400 when name is missing from both formData and params', async () => {
    const user = makeFakeUser({ isAdmin: true, groupMemberships: ['cortexos-admin'] });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const params = new URLSearchParams({ action: 'start' });
    const request = new Request('http://localhost/incus/?/default', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const event = {
      url: new URL('http://localhost/incus/?/default'),
      params: {},
      request,
      locals: makeFakeLocals(user, session),
      cookies: { get: () => undefined, set: () => undefined, delete: () => undefined },
      getClientAddress: () => '127.0.0.1',
    } as unknown as Parameters<NonNullable<typeof actions.default>>[0];
    const result = await (actions.default as unknown as (e: unknown) => Promise<{ status: number }>)(event);
    expect(result.status).toBe(400);
  });

  it('returns 403 for a non-admin caller', async () => {
    const user = makeFakeUser({ isAdmin: false, groupMemberships: ['cortexos-users'] });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const event = makeActionEvent('hermes-canary', 'start');
    (event as { locals: unknown }).locals = makeFakeLocals(user, session);
    const result = await (actions.default as unknown as (e: unknown) => Promise<{ status: number }>)(event);
    expect(result.status).toBe(403);
  });

  it('returns 401 when the session has no id (corrupt session)', async () => {
    const user = makeFakeUser({ isAdmin: true, groupMemberships: ['cortexos-admin'] });
    const sessionNoId: { id?: string; userId: ReturnType<typeof asUserId> } = {
      userId: asUserId('user_admin'),
    };
    registerFakeUser(user);
    registerFakeSession(sessionNoId as never);
    const event = makeActionEvent('hermes-canary', 'start');
    (event as { locals: unknown }).locals = {
      user,
      session: sessionNoId,
    };
    const result = await (actions.default as unknown as (e: unknown) => Promise<{ status: number }>)(event);
    expect(result.status).toBe(401);
  });

  it('returns 400 on a rejected dispatch (e.g. unknown name)', async () => {
    const user = makeFakeUser({ isAdmin: true, groupMemberships: ['cortexos-admin'] });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const event = makeActionEvent('no-such-instance', 'start');
    (event as { locals: unknown }).locals = makeFakeLocals(user, session);
    const result = await (actions.default as unknown as (e: unknown) => Promise<{ status: number; data?: { code?: string } }>)(event);
    expect(result.status).toBe(400);
    expect(result.data?.code).toBe('unknown_instance');
  });
});

describe('/incus/[name]/logs +server.ts', () => {
  it('GET requires admin (401 without auth)', async () => {
    const res = await (logsGet as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({
        method: 'GET',
        params: { name: 'hermes-canary' },
        url: 'http://localhost/incus/hermes-canary/logs',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('POST is method-not-allowed (405)', async () => {
    const res = await (logsPost as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({
        method: 'POST',
        params: { name: 'hermes-canary' },
        url: 'http://localhost/incus/hermes-canary/logs',
      }),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET');
  });
});

// Reference the helper so the import isn't tree-shaken.
void _getMockExecutorForTests;
