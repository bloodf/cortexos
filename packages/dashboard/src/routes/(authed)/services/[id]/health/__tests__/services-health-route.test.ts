/**
 * services-health-route.test.ts — coverage of /services/[id]/health +server.ts.
 *
 * Exercises method gating (405), missing id (400), unknown service (404),
 * and the success path (200 with health snapshot).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  POST as healthPost,
  GET as healthGet,
  PUT as healthPut,
  PATCH as healthPatch,
  DELETE as healthDelete,
} from '../+server';
import {
  createService,
  _resetStubData,
} from '$lib/server/stub-data';
import { makeFakeEvent } from '$lib/server/test-utils';

beforeEach(() => {
  _resetStubData();
  // Seed two services for the happy-path tests.
  createService({
    slug: 'postgresql',
    name: 'PostgreSQL',
    description: null,
    healthUrl: null,
    healthType: 'http',
    category: 'Database',
    openUrl: null,
    status: 'online',
    kind: 'app',
    envSource: null,
    isActive: true,
    hasWebui: false,
    showInHealthcheck: true,
    showInWebui: true,
    sortOrder: 0,
  });
  createService({
    slug: 'caddy',
    name: 'Caddy',
    description: null,
    healthUrl: null,
    healthType: 'http',
    category: 'Infrastructure',
    openUrl: null,
    status: 'online',
    kind: 'app',
    envSource: null,
    isActive: true,
    hasWebui: false,
    showInHealthcheck: true,
    showInWebui: true,
    sortOrder: 0,
  });
});

describe('/services/[id]/health — method gating', () => {
  it('GET returns 405', async () => {
    const res = await (healthGet as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({ method: 'GET', params: { id: 'postgresql' } }),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
  });
  it('PUT returns 405', async () => {
    const res = await (healthPut as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({ method: 'PUT', params: { id: 'postgresql' } }),
    );
    expect(res.status).toBe(405);
  });
  it('PATCH returns 405', async () => {
    const res = await (healthPatch as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({ method: 'PATCH', params: { id: 'postgresql' } }),
    );
    expect(res.status).toBe(405);
  });
  it('DELETE returns 405', async () => {
    const res = await (healthDelete as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({ method: 'DELETE', params: { id: 'postgresql' } }),
    );
    expect(res.status).toBe(405);
  });
});

describe('/services/[id]/health — POST', () => {
  it('returns 400 on missing service id', async () => {
    const res = await (healthPost as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({ method: 'POST', params: {} }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/Missing service/);
  });

  it('returns 404 on unknown service', async () => {
    const res = await (healthPost as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({ method: 'POST', params: { id: 'no-such-service' } }),
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { message: string };
    expect(body.message).toMatch(/not found/);
  });

  it('returns 200 with snapshot when looking up by slug', async () => {
    const res = await (healthPost as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({ method: 'POST', params: { id: 'postgresql' } }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; snapshot: { id: string; status: string } };
    expect(body.ok).toBe(true);
    expect(body.snapshot.id).toBeTruthy();
    expect(body.snapshot.status).toBeTruthy();
  });

  it('returns 200 with snapshot when looking up by id', async () => {
    // The stub uses the slug as the id. Both lookups should work.
    const res = await (healthPost as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({ method: 'POST', params: { id: 'caddy' } }),
    );
    expect(res.status).toBe(200);
  });
});
