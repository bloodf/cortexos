/**
 * wizard-server.test.ts — direct coverage of the incus wizard's
 * per-step server validation action.
 *
 * Closes the v0.4.0 known limitation where per-step validation was
 * client-side only. The `validateStep` action accepts `{ step, values }`
 * and returns the per-step Zod result.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { actions } from '../+page.server';
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
import { _resetIncusBridgeForTests } from '$lib/server/incus/bridge';

beforeEach(() => {
  _resetAllBuckets();
  clearFakeAuth();
  _resetIncusBridgeForTests();
});

function buildFormEvent(step: string, values: unknown, user: ReturnType<typeof makeFakeUser> | null) {
  const session = user ? makeFakeSession(user) : null;
  if (user && session) {
    registerFakeUser(user);
    registerFakeSession(session);
  }
  const base = makeFakeEvent({
    method: 'POST',
    url: 'http://x/incus/wizard?/validateStep',
    locals: makeFakeLocals(user, session),
  });
  // Build a real Request with a form-encoded body so request.formData() works.
  const body = new URLSearchParams();
  body.set('step', step);
  body.set('values', JSON.stringify(values));
  const request = new Request(base.url.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return { ...base, request } as unknown as Parameters<typeof actions.validateStep>[0];
}

function adminForm(step: string, values: unknown) {
  const user = makeFakeUser({ isAdmin: true, groupMemberships: ['cortexos-admin'] });
  return buildFormEvent(step, values, user);
}

function anonForm(step: string, values: unknown) {
  return buildFormEvent(step, values, null);
}

describe('incus wizard validateStep action', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await actions.validateStep(anonForm('target', { mode: 'new' }));
    // fail() returns { status, data } for errors.
    expect((res as { status?: number }).status).toBe(401);
  });

  it('returns 400 when step is missing', async () => {
    const user = makeFakeUser({ isAdmin: true, groupMemberships: ['cortexos-admin'] });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const base = makeFakeEvent({
      method: 'POST',
      url: 'http://x/incus/wizard?/validateStep',
      locals: makeFakeLocals(user, session),
    });
    const body = new URLSearchParams();
    body.set('values', JSON.stringify({}));
    const request = new Request(base.url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const event = { ...base, request } as unknown as Parameters<typeof actions.validateStep>[0];
    const res = await actions.validateStep(event);
    expect((res as { status?: number }).status).toBe(400);
  });

  it('returns 400 when step is not a known value', async () => {
    const res = await actions.validateStep(adminForm('garbage', {}));
    expect((res as { status?: number }).status).toBe(400);
  });

  it('returns 400 when values is not valid JSON', async () => {
    const user = makeFakeUser({ isAdmin: true, groupMemberships: ['cortexos-admin'] });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const base = makeFakeEvent({
      method: 'POST',
      url: 'http://x/incus/wizard?/validateStep',
      locals: makeFakeLocals(user, session),
    });
    const body = new URLSearchParams();
    body.set('step', 'target');
    body.set('values', 'not-json');
    const request = new Request(base.url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const event = { ...base, request } as unknown as Parameters<typeof actions.validateStep>[0];
    const res = await actions.validateStep(event);
    expect((res as { status?: number }).status).toBe(400);
  });

  it('accepts a valid target step', async () => {
    const res = await actions.validateStep(
      adminForm('target', {
        mode: 'new',
        branch: 'main',
        ghOrg: 'cortexos',
        slug: 'test-target',
      }),
    );
    const body = res as { ok?: boolean; step?: string; data?: unknown };
    expect(body.ok).toBe(true);
    expect(body.step).toBe('target');
  });

  it('rejects an invalid target step (missing slug)', async () => {
    const res = await actions.validateStep(
      adminForm('target', {
        mode: 'new',
        branch: 'main',
        ghOrg: 'cortexos',
      }),
    );
    const body = (res as { data?: { ok?: boolean; issues?: unknown[] } }).data;
    expect(body?.ok).toBe(false);
    expect(Array.isArray(body?.issues)).toBe(true);
  });

  it('accepts a valid image step', async () => {
    const res = await actions.validateStep(
      adminForm('image', {
        alias: 'ubuntu/24.04',
        gastown: false,
        profiles: ['default'],
        pool: 'default',
      }),
    );
    expect((res as { ok?: boolean }).ok).toBe(true);
  });

  it('rejects an image step with an out-of-range cpu', async () => {
    const res = await actions.validateStep(
      adminForm('image', {
        alias: 'ubuntu/24.04',
        gastown: false,
        profiles: [],
        cpu: 999, // > max 256
      }),
    );
    const body = (res as { data?: { ok?: boolean } }).data;
    expect(body?.ok).toBe(false);
  });

  it('accepts a valid hermes step', async () => {
    const res = await actions.validateStep(
      adminForm('hermes', { enabled: false, proxies: [] }),
    );
    expect((res as { ok?: boolean }).ok).toBe(true);
  });

  it('accepts a valid network step', async () => {
    const res = await actions.validateStep(
      adminForm('network', { bridge: 'incusbr0', tailscale: true, webAccess: false }),
    );
    expect((res as { ok?: boolean }).ok).toBe(true);
  });

  it('rejects a network step with an empty bridge', async () => {
    const res = await actions.validateStep(
      adminForm('network', { bridge: '', tailscale: false, webAccess: false }),
    );
    const body = (res as { data?: { ok?: boolean } }).data;
    expect(body?.ok).toBe(false);
  });

  it('returns ok:true for review step (no validation, handled by launch)', async () => {
    const res = await actions.validateStep(adminForm('review', null));
    const body = res as { ok?: boolean; step?: string; data?: unknown };
    expect(body.ok).toBe(true);
    expect(body.step).toBe('review');
    expect(body.data).toBeNull();
  });

  it('returns ok:true for profile step (UI-only summary today)', async () => {
    const res = await actions.validateStep(adminForm('profile', null));
    expect((res as { ok?: boolean }).ok).toBe(true);
  });
});
