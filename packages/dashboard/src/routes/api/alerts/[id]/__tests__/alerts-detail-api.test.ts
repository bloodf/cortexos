/**
 * alerts-detail-api.test.ts — direct coverage of /api/alerts/[id]
 * (GET, PATCH, DELETE).
 *
 * The alert list route already has a test; the detail-by-id route
 * does not. We exercise:
 *   - GET happy path / 404
 *   - PATCH happy path / 404 / schema validation
 *   - DELETE happy path / 404
 *   - 401 for unauthenticated, 403 for non-admin (admin gate on
 *     PATCH + DELETE)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GET, PATCH, DELETE } from '../+server';
import {
  _resetStubData,
  createAlertRule,
} from '$lib/server/stub-data';
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

function adminEvent(url: string, method: 'GET' | 'PATCH' | 'DELETE', body?: unknown) {
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
    params: {},
    body,
  });
}

function authedEvent(method: 'GET' | 'PATCH' | 'DELETE', url: string, body?: unknown) {
  // For GET (auth: 'any'), a non-admin user is enough.
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

function eventWithParams(event: ReturnType<typeof makeFakeEvent>, params: Record<string, string>) {
  return { ...event, params } as unknown as Parameters<typeof GET>[0];
}

function seedRule() {
  return createAlertRule({
    name: 'cpu-saturation',
    query: 'avg(cpu) > 0.9',
    severity: 'critical',
    channels: ['slack'],
    enabled: true,
  });
}

describe('GET /api/alerts/[id]', () => {
  it('returns the rule for a known id (any auth)', async () => {
    const rule = seedRule();
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        authedEvent('GET', 'http://localhost/api/alerts/' + rule.id),
        { id: rule.id },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rule: { id: string; name: string } };
    expect(body.rule.id).toBe(rule.id);
    expect(body.rule.name).toBe('cpu-saturation');
  });

  it('returns 404 for an unknown id (any auth)', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        authedEvent('GET', 'http://localhost/api/alerts/nope'),
        { id: 'nope' },
      ),
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 when no session is attached', async () => {
    const rule = seedRule();
    const event = makeFakeEvent({
      method: 'GET',
      url: 'http://localhost/api/alerts/' + rule.id,
    });
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(event, { id: rule.id }),
    );
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/alerts/[id]', () => {
  it('updates a rule (admin)', async () => {
    const rule = seedRule();
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/alerts/' + rule.id, 'PATCH', {
          name: 'cpu-saturation-2',
          enabled: false,
        }),
        { id: rule.id },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rule: { name: string; enabled: boolean } };
    expect(body.rule.name).toBe('cpu-saturation-2');
    expect(body.rule.enabled).toBe(false);
  });

  it('returns 404 for an unknown id (admin)', async () => {
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/alerts/nope', 'PATCH', { name: 'x' }),
        { id: 'nope' },
      ),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid patch payload', async () => {
    const rule = seedRule();
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/alerts/' + rule.id, 'PATCH', {
          severity: 'nope-not-a-real-severity',
        }),
        { id: rule.id },
      ),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 for a non-admin caller', async () => {
    const rule = seedRule();
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        authedEvent('PATCH', 'http://localhost/api/alerts/' + rule.id, {
          name: 'foo',
        }),
        { id: rule.id },
      ),
    );
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/alerts/[id]', () => {
  it('deletes a rule (admin)', async () => {
    const rule = seedRule();
    const res = await (DELETE as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/alerts/' + rule.id, 'DELETE'),
        { id: rule.id },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 404 for an unknown id (admin)', async () => {
    const res = await (DELETE as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/alerts/nope', 'DELETE'),
        { id: 'nope' },
      ),
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 for a non-admin caller', async () => {
    const rule = seedRule();
    const res = await (DELETE as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        authedEvent('DELETE', 'http://localhost/api/alerts/' + rule.id),
        { id: rule.id },
      ),
    );
    expect(res.status).toBe(403);
  });
});
