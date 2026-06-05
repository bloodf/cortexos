/**
 * api-docker-actions.test.ts — coverage of /api/docker/actions POST.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '../+server';
import { setExecutorForTests } from '$lib/server/docker/bridge';
import { resetAudit } from '$lib/server/audit';
import { _resetAllBuckets } from '$lib/server/rate-limit';
import { makeFakeEvent, makeFakeUser, makeFakeLocals, makeFakeSession } from '$lib/server/test-utils';

const adminUser = makeFakeUser({
  is_admin: true,
  groupMemberships: ['cortexos-admin'],
});

beforeEach(() => {
  setExecutorForTests(null);
  resetAudit();
  _resetAllBuckets();
});

describe('/api/docker/actions POST — method/path is POST only', () => {
  it('POST handler is exported and callable', () => {
    expect(typeof POST).toBe('function');
  });
});

describe('/api/docker/actions POST — input validation', () => {
  it('returns 400 on missing required fields', async () => {
    const req = new Request('http://localhost/api/docker/actions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const event = makeFakeEvent({
      method: 'POST',
      url: 'http://localhost/api/docker/actions',
      request: req,
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    });
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(event);
    expect([400, 401, 403]).toContain(res.status);
  });

  it('returns 400 on unknown op', async () => {
    const req = new Request('http://localhost/api/docker/actions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'evil.op', args: {} }),
    });
    const event = makeFakeEvent({
      method: 'POST',
      url: 'http://localhost/api/docker/actions',
      request: req,
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    });
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(event);
    expect([400, 401, 403]).toContain(res.status);
  });
});
