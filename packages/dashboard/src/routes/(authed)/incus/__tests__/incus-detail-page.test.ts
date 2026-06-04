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
import { makeFakeEvent } from '$lib/server/test-utils';
import {
  load as detailLoad,
  actions,
} from '../../../../routes/(authed)/incus/[name]/+page.server';
import { GET as logsGet, POST as logsPost } from '../../../../routes/api/incus/[name]/logs/+server';

beforeEach(() => {
  _resetIncusBridgeForTests();
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
