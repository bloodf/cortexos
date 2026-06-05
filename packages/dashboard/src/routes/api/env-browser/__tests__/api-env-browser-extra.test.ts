/**
 * api-env-browser-extra.test.ts — coverage of the remaining branches
 * in /api/env-browser.
 *
 * The base test (`api-env-browser.test.ts`) only asserts the
 * default GET response shape. This file drives the 5 uncovered
 * branches:
 *
 *   - L58  maskValue: secret key with value.length <= 4 → '••••'
 *   - L59  maskValue: secret key with value.length > 4  → tail 4
 *   - L63  maskValue: entropy fallback (long base64-ish value)
 *   - L93  notFoundError when path is in allowlist but file not registered
 *
 * (The not_found branch surfaces as a 404 with the "Env file not
 * found" message; the maskValue branches are observable in the
 * `value` field of the response entries.)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '../+server';
import { __registerEnvFile } from '../+server';
import { makeFakeEvent, makeFakeUser, makeFakeLocals, makeFakeSession } from '$lib/server/test-utils';
import { resetAudit } from '$lib/server/audit';
import { _resetAllBuckets } from '$lib/server/rate-limit';

const adminUser = makeFakeUser({
  is_admin: true,
  isAdmin: true,
  groupMemberships: [{ name: 'cortexos-admin', isAdmin: true, description: 'admin' }],
});

async function call(path: string, reveal = false) {
  const url = `http://localhost/api/env-browser?path=${encodeURIComponent(path)}${reveal ? '&reveal=true' : ''}`;
  const event = makeFakeEvent({
    method: 'GET',
    url,
    locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
  });
  return (GET as unknown as (e: unknown) => Promise<Response>)(event);
}

beforeEach(() => {
  resetAudit();
  _resetAllBuckets();
});

describe('/api/env-browser — maskValue branches', () => {
  it('masks short secret values to bullet characters', async () => {
    // SECRET_KEY_RE matches "pwd" → maskValue uses the secret branch.
    // value.length is exactly 4 → the `value.length <= 4` branch
    // returns the bare '••••' (no tail).
    __registerEnvFile('/opt/cortexos/.secrets/short.env', [
      { key: 'DB_PWD', value: '1234' },
    ]);
    const res = await call('/opt/cortexos/.secrets/short.env');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries[0].value).toBe('••••');
    expect(body.entries[0].masked).toBe(true);
  });

  it('masks long secret values to bullets + last 4 chars', async () => {
    // SECRET_KEY_RE matches "secret" → secret branch with value.length > 4
    // → '••••••••' + last 4 chars of value.
    __registerEnvFile('/opt/cortexos/.secrets/long.env', [
      { key: 'CLIENT_SECRET', value: 'abcdefgh-secret-1234' },
    ]);
    const res = await call('/opt/cortexos/.secrets/long.env');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries[0].value).toBe('••••••••1234');
    expect(body.entries[0].masked).toBe(true);
  });

  it('masks high-entropy values even when key is non-secret', async () => {
    // key = "NON_SECRET_KEY" — no secret-pattern match.
    // value is 50 chars of base64-ish content → entropy fallback
    // returns '••••••••' + last 4.
    const longValue = 'A'.repeat(46) + 'abcd';
    __registerEnvFile('/opt/cortexos/.secrets/entropy.env', [
      { key: 'NON_SECRET_KEY', value: longValue },
    ]);
    const res = await call('/opt/cortexos/.secrets/entropy.env');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries[0].value).toBe('••••••••abcd');
    expect(body.entries[0].masked).toBe(true);
  });

  it('passes through non-secret short values unchanged', async () => {
    // Sanity check: confirms the `return value;` final fallback.
    __registerEnvFile('/opt/cortexos/.secrets/plain.env', [
      { key: 'PLAIN_KEY', value: 'visible' },
    ]);
    const res = await call('/opt/cortexos/.secrets/plain.env');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries[0].value).toBe('visible');
    expect(body.entries[0].masked).toBe(true);
  });
});

describe('/api/env-browser — not_found path', () => {
  it('returns 404 when the path is allowed but the file is not registered', async () => {
    // L93: the allowlist prefix check passes, but envFiles.get(path)
    // returns undefined → notFoundError.
    const res = await call('/opt/cortexos/.secrets/missing.env');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toMatch(/Env file not found/);
    expect(body.code).toBe('not_found');
  });
});
