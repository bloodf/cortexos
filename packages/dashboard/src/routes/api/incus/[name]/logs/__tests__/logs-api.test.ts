/**
 * incus-logs-api.test.ts — direct coverage of /api/incus/[name]/logs.
 *
 * The route is admin-gated, validates `?limit` (1..500, default 100),
 * and returns `{ instance, limit, count, lines }`. The M1 mock seeds
 * the default instances with no log lines; we append a few via the
 * mock executor to exercise the limit clamp + reverse order.
 *
 * Untested paths in the original UI suite:
 *   - 401 anonymous
 *   - 403 non-admin
 *   - 400 missing instance name
 *   - 404 instance not found
 *   - 200 with default limit
 *   - 200 with limit=5 (clamped to <=500)
 *   - 200 with limit=99999 (clamped to MAX_LIMIT=500)
 *   - 200 with limit=0 → falls back to DEFAULT_LIMIT=100
 *   - 200 with limit=abc → falls back to DEFAULT_LIMIT=100
 *   - 405 for POST/PUT/PATCH/DELETE
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST, PUT, PATCH, DELETE } from '../+server';
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
import { _getMockExecutorForTests, _resetIncusBridgeForTests } from '$lib/server/incus/bridge';

beforeEach(() => {
  _resetAllBuckets();
  clearFakeAuth();
  _resetIncusBridgeForTests();
});

function adminEvent(url: string) {
  const user = makeFakeUser({
    is_admin: true,
    groupMemberships: ['cortexos-admin' as const],
  });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return makeFakeEvent({
    method: 'GET',
    url,
    locals: makeFakeLocals(user, session),
    params: {},
  });
}

function anonEvent(url: string) {
  return makeFakeEvent({
    method: 'GET',
    url,
    locals: makeFakeLocals(null, null),
    params: {},
  });
}

function nonAdminEvent(url: string) {
  const user = makeFakeUser({
    is_admin: false,
    groupMemberships: ['cortexos-users' as const],
  });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return makeFakeEvent({
    method: 'GET',
    url,
    locals: makeFakeLocals(user, session),
    params: {},
  });
}

function eventWithParams(event: ReturnType<typeof makeFakeEvent>, params: Record<string, string>) {
  return { ...event, params } as unknown as Parameters<typeof GET>[0];
}

describe('GET /api/incus/[name]/logs', () => {
  it('returns 401 for anonymous', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      anonEvent('http://x/api/incus/foo/logs'),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      nonAdminEvent('http://x/api/incus/foo/logs'),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 when instance name is missing', async () => {
    const ev = adminEvent('http://x/api/incus//logs');
    const res = await GET(eventWithParams(ev, { name: '' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('validation');
  });

  it('returns 404 when the instance does not exist', async () => {
    const ev = adminEvent('http://x/api/incus/does-not-exist/logs');
    const res = await GET(eventWithParams(ev, { name: 'does-not-exist' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('not_found');
  });

  it('returns 200 with default limit=100 and reverse-ordered lines', async () => {
    const mock = _getMockExecutorForTests();
    mock.pushLog('hermes-canary', { ts: '2024-01-01T00:00:01Z', priority: 'info', name: 'hermes-canary', message: 'first' });
    mock.pushLog('hermes-canary', { ts: '2024-01-01T00:00:02Z', priority: 'info', name: 'hermes-canary', message: 'second' });
    mock.pushLog('hermes-canary', { ts: '2024-01-01T00:00:03Z', priority: 'info', name: 'hermes-canary', message: 'third' });

    const ev = adminEvent('http://x/api/incus/hermes-canary/logs');
    const res = await GET(eventWithParams(ev, { name: 'hermes-canary' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.instance).toBe('hermes-canary');
    expect(body.limit).toBe(100);
    // Default mock seeds 2 lines for hermes-canary; we appended 3 more.
    expect(body.count).toBeGreaterThanOrEqual(3);
    // The 3 we appended are at the head (newest first) because of the higher ts.
    expect(body.lines[0].message).toBe('third');
    expect(body.lines[1].message).toBe('second');
    expect(body.lines[2].message).toBe('first');
  });

  it('honors ?limit=N (1..500)', async () => {
    const mock = _getMockExecutorForTests();
    for (let i = 0; i < 10; i++) {
      mock.pushLog('hermes-canary', { ts: `2099-01-01T00:00:${String(i).padStart(2, '0')}Z`, priority: 'info', name: 'hermes-canary', message: `m${i}` });
    }
    const ev = adminEvent('http://x/api/incus/hermes-canary/logs?limit=3');
    const res = await GET(eventWithParams(ev, { name: 'hermes-canary' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBe(3);
    expect(body.count).toBe(3);
    expect(body.lines[0].message).toBe('m9');
  });

  it('clamps ?limit=99999 down to MAX_LIMIT=500', async () => {
    const mock = _getMockExecutorForTests();
    mock.pushLog('hermes-canary', { ts: '2024-01-01T00:00:00Z', priority: 'info', name: 'hermes-canary', message: 'a' });
    const ev = adminEvent('http://x/api/incus/hermes-canary/logs?limit=99999');
    const res = await GET(eventWithParams(ev, { name: 'hermes-canary' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.limit).toBe(500);
  });

  it('falls back to DEFAULT_LIMIT=100 when limit=0', async () => {
    const mock = _getMockExecutorForTests();
    mock.pushLog('hermes-canary', { ts: '2024-01-01T00:00:00Z', priority: 'info', name: 'hermes-canary', message: 'a' });
    const ev = adminEvent('http://x/api/incus/hermes-canary/logs?limit=0');
    const res = await GET(eventWithParams(ev, { name: 'hermes-canary' }));
    const body = await res.json();
    expect(body.limit).toBe(100);
  });

  it('falls back to DEFAULT_LIMIT=100 when limit is non-numeric', async () => {
    const mock = _getMockExecutorForTests();
    mock.pushLog('hermes-canary', { ts: '2024-01-01T00:00:00Z', priority: 'info', name: 'hermes-canary', message: 'a' });
    const ev = adminEvent('http://x/api/incus/hermes-canary/logs?limit=abc');
    const res = await GET(eventWithParams(ev, { name: 'hermes-canary' }));
    const body = await res.json();
    expect(body.limit).toBe(100);
  });

  it('returns 200 with at least 1 line for a seeded instance (sanity check)', async () => {
    const ev = adminEvent('http://x/api/incus/hermes-canary/logs');
    const res = await GET(eventWithParams(ev, { name: 'hermes-canary' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.lines.length).toBe(body.count);
  });
});

describe('non-GET methods on /api/incus/[name]/logs', () => {
  it.each([
    ['POST', POST],
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ])('%s returns 405', async (_name, handler) => {
    const user = makeFakeUser({
      is_admin: true,
      groupMemberships: ['cortexos-admin' as const],
    });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const ev = makeFakeEvent({
      method: 'POST',
      url: 'http://x/api/incus/hermes-canary/logs',
      locals: makeFakeLocals(user, session),
      params: { name: 'hermes-canary' },
    }) as unknown as Parameters<typeof POST>[0];
    const res = await (handler as unknown as (e: unknown) => Promise<Response>)(ev);
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET');
  });
});
