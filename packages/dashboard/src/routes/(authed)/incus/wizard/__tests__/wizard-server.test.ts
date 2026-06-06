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

// The SvelteKit `Actions` type declares each action as possibly
// undefined; the test always calls these actions which are guaranteed
// to exist. Pull them out once so the test bodies don't have to do
// `actions.xxx!` at every call site.
const validateStep = actions.validateStep!;
const preflight = actions.preflight!;
const launch = actions.launch!;
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
  return { ...base, request } as unknown as Parameters<typeof validateStep>[0];
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
    const res = await validateStep(anonForm('target', { mode: 'new' }));
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
    const event = { ...base, request } as unknown as Parameters<typeof validateStep>[0];
    const res = await validateStep(event);
    expect((res as { status?: number }).status).toBe(400);
  });

  it('returns 400 when step is not a known value', async () => {
    const res = await validateStep(adminForm('garbage', {}));
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
    const event = { ...base, request } as unknown as Parameters<typeof validateStep>[0];
    const res = await validateStep(event);
    expect((res as { status?: number }).status).toBe(400);
  });

  it('accepts a valid target step', async () => {
    const res = await validateStep(
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
    const res = await validateStep(
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
    const res = await validateStep(
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
    const res = await validateStep(
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
    const res = await validateStep(
      adminForm('hermes', { enabled: false, proxies: [] }),
    );
    expect((res as { ok?: boolean }).ok).toBe(true);
  });

  it('accepts a valid network step', async () => {
    const res = await validateStep(
      adminForm('network', { bridge: 'incusbr0', tailscale: true, webAccess: false }),
    );
    expect((res as { ok?: boolean }).ok).toBe(true);
  });

  it('rejects a network step with an empty bridge', async () => {
    const res = await validateStep(
      adminForm('network', { bridge: '', tailscale: false, webAccess: false }),
    );
    const body = (res as { data?: { ok?: boolean } }).data;
    expect(body?.ok).toBe(false);
  });

  it('returns ok:true for review step (no validation, handled by launch)', async () => {
    const res = await validateStep(adminForm('review', null));
    const body = res as { ok?: boolean; step?: string; data?: unknown };
    expect(body.ok).toBe(true);
    expect(body.step).toBe('review');
    expect(body.data).toBeNull();
  });

  it('returns ok:true for profile step (UI-only summary today)', async () => {
    const res = await validateStep(adminForm('profile', null));
    expect((res as { ok?: boolean }).ok).toBe(true);
  });
});

describe('incus wizard preflight action', () => {
  function preflightForm(config: unknown) {
    const user = makeFakeUser({ isAdmin: true, groupMemberships: ['cortexos-admin'] });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const body = new URLSearchParams();
    body.set('config', JSON.stringify(config));
    const base = makeFakeEvent({
      method: 'POST',
      url: 'http://x/incus/wizard?/preflight',
      locals: makeFakeLocals(user, session),
    });
    const request = new Request(base.url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { ...base, request } as unknown as Parameters<typeof preflight>[0];
  }

  it('returns the preflight report for a valid config', async () => {
    const config = {
      target: { mode: 'new', branch: 'main', ghOrg: 'cortexos', slug: 'preflight-test' },
      image: { alias: 'ubuntu/24.04', gastown: false, profiles: ['default'], pool: 'default' },
      hermes: { enabled: false, proxies: [] },
      network: { bridge: 'incusbr0', tailscale: true, webAccess: false },
    };
    const res = await preflight(preflightForm(config));
    const body = res as { ok?: boolean; report?: { ok: boolean } };
    expect(body.ok).toBe(true);
    expect(body.report?.ok).toBe(true);
  });

  it('returns a failing report for a config with unknown image (but does not 400 — launch is the gate)', async () => {
    const config = {
      target: { mode: 'new', branch: 'main', ghOrg: 'cortexos', slug: 'preflight-fail' },
      image: { alias: 'unknown/99', gastown: false, profiles: [], pool: 'default' },
      hermes: { enabled: false, proxies: [] },
      network: { bridge: 'incusbr0', tailscale: true, webAccess: false },
    };
    const res = await preflight(preflightForm(config));
    // The preflight action always returns 200 with a structured report;
    // the launch action is the gate that actually rejects ok:false reports.
    const body = res as { ok?: boolean; report?: { ok: boolean } };
    expect(body.ok).toBe(true);
    expect(body.report?.ok).toBe(false);
  });

  it('returns 400 when config is missing from formData', async () => {
    const user = makeFakeUser({ isAdmin: true });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const base = makeFakeEvent({
      method: 'POST',
      url: 'http://x/incus/wizard?/preflight',
      locals: makeFakeLocals(user, session),
    });
    const request = new Request(base.url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: '',
    });
    const event = { ...base, request } as unknown as Parameters<typeof preflight>[0];
    const res = await preflight(event);
    expect((res as { status?: number }).status).toBe(400);
  });

  it('returns 400 when config is invalid JSON', async () => {
    const user = makeFakeUser({ isAdmin: true });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const body = new URLSearchParams();
    body.set('config', 'not-json{');
    const base = makeFakeEvent({
      method: 'POST',
      url: 'http://x/incus/wizard?/preflight',
      locals: makeFakeLocals(user, session),
    });
    const request = new Request(base.url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const event = { ...base, request } as unknown as Parameters<typeof preflight>[0];
    const res = await preflight(event);
    expect((res as { status?: number }).status).toBe(400);
  });
});

describe('incus wizard launch action', () => {
  function launchForm(config: unknown) {
    const user = makeFakeUser({ isAdmin: true, groupMemberships: ['cortexos-admin'] });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const body = new URLSearchParams();
    body.set('config', JSON.stringify(config));
    const base = makeFakeEvent({
      method: 'POST',
      url: 'http://x/incus/wizard?/launch',
      locals: makeFakeLocals(user, session),
    });
    const request = new Request(base.url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { ...base, request } as unknown as Parameters<typeof launch>[0];
  }

  const baseConfig = {
    target: { mode: 'new' as const, branch: 'main', ghOrg: 'cortexos', slug: 'launch-test' },
    image: { alias: 'ubuntu/24.04', gastown: false, profiles: ['default'], pool: 'default' },
    hermes: { enabled: false, proxies: [] },
    network: { bridge: 'incusbr0', tailscale: true, webAccess: false },
  };

  it('returns 401 for anonymous', async () => {
    const base = makeFakeEvent({
      method: 'POST',
      url: 'http://x/incus/wizard?/launch',
      locals: makeFakeLocals(null, null),
    });
    const body = new URLSearchParams();
    body.set('config', JSON.stringify(baseConfig));
    const request = new Request(base.url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const event = { ...base, request } as unknown as Parameters<typeof launch>[0];
    const res = await launch(event);
    expect((res as { status?: number }).status).toBe(401);
  });

  it('returns 403 for a non-admin caller', async () => {
    const user = makeFakeUser({ isAdmin: false });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const event = launchForm(baseConfig);
    // Override locals to be the non-admin.
    (event as { locals: unknown }).locals = makeFakeLocals(user, session);
    const res = await launch(event);
    expect((res as { status?: number }).status).toBe(403);
  });

  it('returns 409 when the instance name already exists', async () => {
    const res = await launch(launchForm({
      ...baseConfig,
      target: { ...baseConfig.target, slug: 'hermes-canary' },
    }));
    expect((res as { status?: number }).status).toBe(409);
  });

  it('seeds a new instance and returns provisioning status for a valid config', async () => {
    const res = await launch(launchForm({
      ...baseConfig,
      target: { ...baseConfig.target, slug: 'brand-new-instance' },
    }));
    const body = res as { ok?: boolean; name?: string; status?: string };
    expect(body.ok).toBe(true);
    expect(body.name).toBe('brand-new-instance');
    expect(body.status).toBe('provisioning');
  });

  it('returns 400 when preflight fails (unknown image)', async () => {
    const res = await launch(launchForm({
      ...baseConfig,
      target: { ...baseConfig.target, slug: 'preflight-fail-launch' },
      image: { ...baseConfig.image, alias: 'unknown/99' },
    }));
    expect((res as { status?: number }).status).toBe(400);
  });

  it('returns 400 when config is missing from formData', async () => {
    const user = makeFakeUser({ isAdmin: true });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const base = makeFakeEvent({
      method: 'POST',
      url: 'http://x/incus/wizard?/launch',
      locals: makeFakeLocals(user, session),
    });
    const request = new Request(base.url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: '',
    });
    const event = { ...base, request } as unknown as Parameters<typeof launch>[0];
    const res = await launch(event);
    expect((res as { status?: number }).status).toBe(400);
  });
});
