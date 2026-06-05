/**
 * api-incus-actions.test.ts — coverage of /api/incus/actions POST.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '../+server';
import { resetAudit } from '$lib/server/audit';
import { _resetAllBuckets } from '$lib/server/rate-limit';
import { makeFakeEvent, makeFakeUser, makeFakeLocals, makeFakeSession } from '$lib/server/test-utils';

const adminUser = makeFakeUser({
  is_admin: true,
  groupMemberships: ['cortexos-admin'],
});

beforeEach(() => {
  resetAudit();
  _resetAllBuckets();
});

describe('/api/incus/actions POST — handler exists', () => {
  it('POST is exported', () => {
    expect(typeof POST).toBe('function');
  });
});

describe('/api/incus/actions POST — input validation', () => {
  it('returns 4xx on missing body', async () => {
    const req = new Request('http://localhost/api/incus/actions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const event = makeFakeEvent({
      method: 'POST',
      url: 'http://localhost/api/incus/actions',
      request: req,
      locals: makeFakeLocals(adminUser, makeFakeSession(adminUser)),
    });
    const res = await (POST as unknown as (e: unknown) => Promise<Response>)(event);
    expect([400, 401, 403, 404]).toContain(res.status);
  });
});
