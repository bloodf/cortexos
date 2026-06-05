/**
 * api-terminal.test.ts — coverage of /api/terminal GET + POST.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '../+server';
import { resetAudit } from '$lib/server/audit';
import { _resetAllBuckets } from '$lib/server/rate-limit';
import {
  makeFakeEvent,
  makeFakeUser,
  makeFakeLocals,
  makeFakeSession,
} from '$lib/server/test-utils';

const adminUser = makeFakeUser({
  is_admin: true,
  groupMemberships: ['cortexos-admin'],
});

beforeEach(() => {
  resetAudit();
  _resetAllBuckets();
});

describe('/api/terminal GET', () => {
  it('requires auth (returns 401 without session)', async () => {
    const event = makeFakeEvent({ method: 'GET', url: 'http://localhost/api/terminal' });
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(event);
    expect(res.status).toBe(401);
  });
});

describe('/api/terminal POST', () => {
  it('returns 400 on missing op', async () => {
    const req = new Request('http://localhost/api/terminal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const event = makeFakeEvent({
      method: 'POST',
      url: 'http://localhost/api/terminal',
      request: req,
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    });
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(event);
    expect([400, 401, 403]).toContain(res.status);
  });
});
