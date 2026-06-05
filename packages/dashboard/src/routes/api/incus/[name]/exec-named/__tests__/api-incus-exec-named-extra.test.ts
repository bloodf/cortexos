/**
 * api-incus-exec-named-extra.test.ts — coverage of the remaining
 * branches in /api/incus/[name]/exec-named.
 *
 * The base test file isn't a test — the route is exercised via the
 * incus/bridge.test.ts. This file drives the 5 uncovered route
 * branches:
 *
 *   - L32  missing `name` path param   → 400 with "Missing instance name"
 *   - L45  invalid JSON body           → 400 with "Invalid JSON body"
 *   - L84  result.field present in rejected result → echoed in body
 *   - L93/95/97  PUT/PATCH/DELETE      → 405 with `allow: POST` header
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET, PUT, PATCH, DELETE } from '../+server';
import { setExecutorForTests } from '$lib/server/incus/bridge';
import { resetAudit } from '$lib/server/audit';
import { _resetAllBuckets } from '$lib/server/rate-limit';
import { makeFakeEvent, makeFakeUser, makeFakeLocals, makeFakeSession } from '$lib/server/test-utils';

const adminUser = makeFakeUser({
  is_admin: true,
  isAdmin: true,
  groupMemberships: [{ name: 'cortexos-admin', isAdmin: true, description: 'admin' }],
});

beforeEach(() => {
  setExecutorForTests(null);
  resetAudit();
  _resetAllBuckets();
  vi.restoreAllMocks();
});

async function post(name: string | null, body: unknown, raw?: string) {
  const url = name
    ? `http://localhost/api/incus/${name}/exec-named`
    : `http://localhost/api/incus/exec-named`;
  const event = makeFakeEvent({
    method: 'POST',
    url,
    body: raw === undefined ? body : raw,
    params: name ? { name } : {},
    locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
  });
  return (POST as unknown as (e: unknown) => Promise<Response>)(event);
}

describe('/api/incus/[name]/exec-named — POST validation paths', () => {
  it('returns 400 when the name path param is missing', async () => {
    // L32: when `event.params.name` is empty, the route short-
    // circuits with 400 "Missing instance name". We achieve this by
    // sending a name whose URL slug is the empty string.
    const res = await post('', { op: 'term.ps', args: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/Missing instance name/i);
  });

  it('returns 400 on an unparseable JSON body', async () => {
    // L45: event.request.json() throws → "Invalid JSON body".
    // makeFakeEvent sets `body` to a string → forwarded as the raw
    // request body, which then fails JSON.parse inside the route.
    const res = await post('demo', null, '{not-valid-json');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/Invalid JSON/i);
  });

  it('returns 400 with issues when the Zod schema rejects the body', async () => {
    // L48–L53: the body parses as JSON but fails Zod.
    const res = await post('demo', { op: 'definitely-not-a-real-op', args: {} });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/Invalid input shape/i);
    expect(Array.isArray(body.issues)).toBe(true);
  });
});

describe('/api/incus/[name]/exec-named — POST result mapping', () => {
  it('echoes the rejected result.code + result.field in the response body', async () => {
    // L84: the bridge's `rejected` result carries an optional
    // `field` (e.g. for arg-smuggling rejections). The route's
    // `...(result.field ? { field: result.field } : {})` spread
    // echoes it to the client.
    //
    // We mock the bridge module to return a `rejected` result
    // WITH a `field` set, then call the route through the public
    // surface. The mock instance is auto-seeded by
    // `setExecutorForTests(null)` (default mock).
    const { dispatchExecNamed } = await import('$lib/server/incus/bridge');
    vi.spyOn(await import('$lib/server/incus/bridge'), 'dispatchExecNamed').mockImplementation(
      async () => ({
        status: 'rejected',
        op: 'term.exec_named' as never,
        code: 'arg_smuggling',
        reason: 'arg-smuggling detected (test mock)',
        field: 'args.command',
      }),
    );
    void dispatchExecNamed; // silence unused warning
    const res = await post('demo', { op: 'term.exec_named', args: { command: 'rm -rf /' } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('arg_smuggling');
    expect(body.field).toBe('args.command');
  });

  it('returns 200 for an accepted exec-named op', async () => {
    // The default mock executor handles the seed instances; the
    // existing seed should include at least one instance name.
    const { _SEED_INSTANCES } = await import('$lib/server/incus/bridge');
    const seed = _SEED_INSTANCES[0];
    if (!seed) throw new Error('incus bridge has no seed instances');
    const res = await post(seed.name, { op: 'term.ps', args: {} });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('accepted');
    expect(body.op).toBe('term.ps');
  });
});

describe('/api/incus/[name]/exec-named — method gating', () => {
  it.each([
    ['GET', GET],
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ])('returns 405 for %s with allow:POST header', async (method, handler) => {
    const event = makeFakeEvent({
      method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      url: 'http://localhost/api/incus/demo/exec-named',
      params: { name: 'demo' },
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    });
    const res = await (handler as unknown as (e: unknown) => Promise<Response>)(event);
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
  });
});
