/**
 * systemd-detail-page.test.ts — coverage of the /systemd/[name] route
 * server load + form actions. Exercises:
 *   - load: 400 on missing name, 404 on unknown unit, success on real unit
 *   - actions.default: 400 on unknown action, 401 unauth, 403 non-admin,
 *     401 missing session id, 200 success, 403 approval_required,
 *     400 rejected
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { load, actions } from '../+page.server';
import {
  _resetSystemdBridgeForTests,
} from '$lib/server/systemd/bridge';
import { resetAudit } from '$lib/server/audit';
import { _resetAllBuckets } from '$lib/server/rate-limit';
import {
  makeFakeEvent,
  makeFakeUser,
  makeFakeLocals,
  makeFakeSession,
} from '$lib/server/test-utils';
import { InMemorySessionStore, setSessionStore, resetSessionStore } from '$lib/server/auth';

const adminUser = makeFakeUser({
  is_admin: true,
  groupMemberships: ['cortexos-admin'],
});
const nonAdminUser = makeFakeUser({
  is_admin: false,
  groupMemberships: ['cortexos-users'],
});

beforeEach(() => {
  _resetSystemdBridgeForTests();
  resetAudit();
  _resetAllBuckets();
  resetSessionStore();
});

describe('/systemd/[name] — load', () => {
  it('throws 400 when name is missing', async () => {
    try {
      await load({
        params: {},
        locals: makeFakeLocals(adminUser, null),
      } as never);
      expect.fail('expected throw');
    } catch (e) {
      expect((e as { status: number }).status).toBe(400);
    }
  });

  it('throws 404 when unit is unknown', async () => {
    try {
      await load({
        params: { name: 'does-not-exist.service' },
        locals: makeFakeLocals(adminUser, null),
      } as never);
      expect.fail('expected throw');
    } catch (e) {
      expect((e as { status: number }).status).toBe(404);
    }
  });

  it('returns unit + logs for a real unit', async () => {
    const out = (await load({
      params: { name: 'caddy.service' },
      locals: makeFakeLocals(adminUser, null),
    } as never)) as { unit: { name: string }; logs: unknown[]; isAdmin: boolean };
    expect(out.unit.name).toBe('caddy.service');
    expect(Array.isArray(out.logs)).toBe(true);
    expect(out.isAdmin).toBe(true);
  });

  it('returns isAdmin=false for a non-admin user', async () => {
    const out = (await load({
      params: { name: 'caddy.service' },
      locals: makeFakeLocals(nonAdminUser, null),
    } as never)) as { isAdmin: boolean };
    expect(out.isAdmin).toBe(false);
  });

  it('returns isAdmin=false when no user is in locals', async () => {
    const out = (await load({
      params: { name: 'caddy.service' },
      locals: {},
    } as never)) as { isAdmin: boolean };
    expect(out.isAdmin).toBe(false);
  });
});

function formRequest(body: Record<string, string>, method = 'POST') {
  const sp = new URLSearchParams(body).toString();
  return new Request('http://localhost/systemd/caddy.service', {
    method,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: sp,
  });
}

function postEventWithForm(body: Record<string, string>, params: Record<string, string>, locals: Record<string, unknown>) {
  // Build the form-encoded request manually, then wrap in a fake event.
  const sp = new URLSearchParams(body).toString();
  const req = new Request('http://localhost/systemd/caddy.service', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: sp,
  });
  const event = makeFakeEvent({ method: 'GET', params, locals: locals as never });
  // Swap the request so formData() works with the encoded body.
  (event as unknown as { request: Request }).request = req;
  return event;
}

describe('/systemd/[name] — actions.default', () => {
  it('returns fail(400) on unknown action', async () => {
    const event = postEventWithForm(
      { action: 'reboot', name: 'caddy.service' },
      { name: 'caddy.service' },
      makeFakeLocals(adminUser, null),
    );
    const out = (await actions.default!(event as never)) as { status?: number; data?: { error: string } };
    expect(out.status).toBe(400);
    expect(out.data?.error).toMatch(/Unknown action/);
  });

  it('returns fail(400) when name is missing from form and params', async () => {
    const event = postEventWithForm(
      { action: 'start' },
      {},
      makeFakeLocals(adminUser, null),
    );
    const out = (await actions.default!(event as never)) as { status?: number; data?: { error: string } };
    expect(out.status).toBe(400);
    expect(out.data?.error).toMatch(/Missing unit name/);
  });

  it('returns fail(401) when no session is resolved', async () => {
    const event = postEventWithForm(
      { action: 'start', name: 'caddy.service' },
      { name: 'caddy.service' },
      {},
    );
    const out = (await actions.default!(event as never)) as { status?: number; data?: { error: string } };
    expect(out.status).toBe(401);
  });

  it('returns fail(403) when user is not admin', async () => {
    const store = new InMemorySessionStore();
    setSessionStore(store);
    const session = makeFakeSession(nonAdminUser);
    const event = postEventWithForm(
      { action: 'start', name: 'caddy.service' },
      { name: 'caddy.service' },
      makeFakeLocals(nonAdminUser, session),
    );
    const out = (await actions.default!(event as never)) as { status?: number; data?: { error: string } };
    expect(out.status).toBe(403);
  });

  it('returns fail(401) when session has no id', async () => {
    const brokenSession = { ...makeFakeSession(adminUser), id: undefined as unknown as string } as Parameters<typeof makeFakeLocals>[1];
    const event = postEventWithForm(
      { action: 'start', name: 'caddy.service' },
      { name: 'caddy.service' },
      makeFakeLocals(adminUser, brokenSession),
    );
    const out = (await actions.default!(event as never)) as { status?: number; data?: { error: string } };
    expect(out.status).toBe(401);
  });

  it('returns ok:true on a successful start action', async () => {
    const event = postEventWithForm(
      { action: 'start', name: 'caddy.service' },
      { name: 'caddy.service' },
      makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    );
    const out = (await actions.default!(event as never)) as { ok?: boolean; action?: string };
    expect(out.ok).toBe(true);
    expect(out.action).toBe('start');
  });

  it('returns fail(403) with approval_required on a destructive action without token', async () => {
    const event = postEventWithForm(
      { action: 'restart', name: 'caddy.service' },
      { name: 'caddy.service' },
      makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    );
    const out = (await actions.default!(event as never)) as { status?: number; data?: { approvalRequired?: boolean; actionHash?: string; ttlSec?: number; action?: string } };
    expect(out.status).toBe(403);
    expect(out.data?.approvalRequired).toBe(true);
    expect(out.data?.actionHash).toBeTruthy();
    expect(out.data?.ttlSec).toBeGreaterThan(0);
    expect(out.data?.action).toBe('restart');
  });

  it('returns fail(400) when the bridge rejects the dispatch', async () => {
    const event = postEventWithForm(
      { action: 'start', name: '../etc/passwd' },
      { name: '../etc/passwd' },
      makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    );
    const out = (await actions.default!(event as never)) as { status?: number; data?: { code?: string; action?: string } };
    expect(out.status).toBe(400);
    expect(out.data?.code).toBeTruthy();
  });
});
