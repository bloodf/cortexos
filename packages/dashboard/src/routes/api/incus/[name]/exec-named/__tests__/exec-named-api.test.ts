/**
 * incus-exec-named-api.test.ts — direct coverage of
 * /api/incus/[name]/exec-named (PB-4 FIX).
 *
 * The route validates the inner `op` against the same allowlist
 * the terminal route uses (`term.exec_named`). The M1 stub returns
 * the mapped argv and the `accepted` status; M3 will dispatch.
 *
 * Untested paths in the original UI suite:
 *   - op not on the allowlist  → 400
 *   - shell arg validation fails → 400
 *   - requiresApproval path → 403 with confirmation token
 *   - 401 / 403 admin gate
 *   - 405 for non-POST
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '../+server';
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
  _resetAllBuckets();
  clearFakeAuth();
});

function adminEvent(url: string, body?: unknown) {
  const user = makeFakeUser({
    is_admin: true,
    groupMemberships: [{ name: 'cortexos-admin', isAdmin: true }],
  });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return makeFakeEvent({
    method: 'POST',
    url,
    locals: makeFakeLocals(user, session),
    params: {},
    body,
  });
}

function eventWithParams(event: ReturnType<typeof makeFakeEvent>, params: Record<string, string>) {
  return { ...event, params } as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/incus/[name]/exec-named', () => {
  it('accepts a known allowlisted op (M1 stub returns argv)', async () => {
    // The allowlist inner ops are the `term.*` subcommands.
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/incus/web-1/exec-named', {
          op: 'term.ps',
          args: {},
        }),
        { name: 'web-1' },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; argv: string[]; op: string };
    expect(body.status).toBe('accepted');
    expect(body.argv.length).toBeGreaterThan(0);
    expect(body.op).toBe('term.ps');
  });

  it('rejects an unknown op with 400', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/incus/web-1/exec-named', {
          op: 'totally.bogus',
          args: {},
        }),
        { name: 'web-1' },
      ),
    );
    expect(res.status).toBe(400);
  });

  it('rejects shell metacharacters in string args with 400', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/incus/web-1/exec-named', {
          op: 'term.ps',
          args: { path: '/; rm -rf /' },
        }),
        { name: 'web-1' },
      ),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 with confirmation token for an op that requires approval', async () => {
    // The terminal exec-named allowlist has destructive ops (e.g.
    // `incus.delete`) marked `requiresApproval: true`. Going through
    // exec-named must surface the same approval gate.
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/incus/web-1/exec-named', {
          op: 'incus.delete',
          args: {},
        }),
        { name: 'web-1' },
      ),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get('x-cortex-confirmation-token-required')).toBe('true');
  });

  it('returns 400 when op is missing', async () => {
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(
        adminEvent('http://localhost/api/incus/web-1/exec-named', { args: {} }),
        { name: 'web-1' },
      ),
    );
    expect(res.status).toBe(400);
  });

  it('returns 401 when no session is attached', async () => {
    const event = makeFakeEvent({
      method: 'POST',
      url: 'http://localhost/api/incus/web-1/exec-named',
      body: { op: 'incus.ls', args: {} },
    });
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(event, { name: 'web-1' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin caller', async () => {
    const user = makeFakeUser({ is_admin: false, groupMemberships: [] });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const event = makeFakeEvent({
      method: 'POST',
      url: 'http://localhost/api/incus/web-1/exec-named',
      locals: makeFakeLocals(user, session),
      body: { op: 'incus.ls', args: {} },
    });
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(
      eventWithParams(event, { name: 'web-1' }),
    );
    expect(res.status).toBe(403);
  });
});
