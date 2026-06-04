/**
 * services-detail-api.test.ts — direct coverage of /api/services/[id]
 * (GET, PATCH, DELETE).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GET, PATCH, DELETE } from '../+server';
import {
  _resetStubData,
  createService,
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

function seedService() {
  return createService({
    slug: 'caddy',
    name: 'Caddy',
    description: 'Reverse proxy',
    healthUrl: 'http://localhost:2019/health',
    healthType: 'http',
    category: 'edge',
    openUrl: 'http://localhost:2019',
    isActive: true,
    showInHealthcheck: true,
    showInWebui: true,
    sortOrder: 10,
  });
}

describe('GET /api/services/[id]', () => {
  it('returns the service for a known id (any auth)', async () => {
    const svc = seedService();
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        authedEvent('GET', 'http://localhost/api/services/' + svc.id),
        { id: svc.id },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: { id: string; slug: string } };
    expect(body.service.id).toBe(svc.id);
    expect(body.service.slug).toBe('caddy');
  });

  it('returns 404 for an unknown id (any auth)', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        authedEvent('GET', 'http://localhost/api/services/nope'),
        { id: 'nope' },
      ),
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 when no session is attached', async () => {
    const svc = seedService();
    const event = makeFakeEvent({
      method: 'GET',
      url: 'http://localhost/api/services/' + svc.id,
    });
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(event, { id: svc.id }),
    );
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/services/[id]', () => {
  it('updates a service (admin)', async () => {
    const svc = seedService();
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/services/' + svc.id, 'PATCH', {
          description: 'Updated description',
          isActive: false,
        }),
        { id: svc.id },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      service: { description: string; isActive: boolean };
    };
    expect(body.service.description).toBe('Updated description');
    expect(body.service.isActive).toBe(false);
  });

  it('returns 404 for an unknown id (admin)', async () => {
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/services/nope', 'PATCH', { name: 'x' }),
        { id: 'nope' },
      ),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid healthUrl', async () => {
    const svc = seedService();
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/services/' + svc.id, 'PATCH', {
          healthUrl: 'not-a-url',
        }),
        { id: svc.id },
      ),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid healthType', async () => {
    const svc = seedService();
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/services/' + svc.id, 'PATCH', {
          healthType: 'nope-not-a-real-type',
        }),
        { id: svc.id },
      ),
    );
    expect(res.status).toBe(400);
  });

  it('accepts null description (clearing it)', async () => {
    const svc = seedService();
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/services/' + svc.id, 'PATCH', {
          description: null,
        }),
        { id: svc.id },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { service: { description: string | null } };
    expect(body.service.description).toBeNull();
  });

  it('returns 403 for a non-admin caller', async () => {
    const svc = seedService();
    const res = await (PATCH as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        authedEvent('PATCH', 'http://localhost/api/services/' + svc.id, { name: 'foo' }),
        { id: svc.id },
      ),
    );
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/services/[id]', () => {
  it('deletes a service (admin)', async () => {
    const svc = seedService();
    const res = await (DELETE as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/services/' + svc.id, 'DELETE'),
        { id: svc.id },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 404 for an unknown id (admin)', async () => {
    const res = await (DELETE as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/services/nope', 'DELETE'),
        { id: 'nope' },
      ),
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 for a non-admin caller', async () => {
    const svc = seedService();
    const res = await (DELETE as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        authedEvent('DELETE', 'http://localhost/api/services/' + svc.id),
        { id: svc.id },
      ),
    );
    expect(res.status).toBe(403);
  });
});
