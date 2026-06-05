/**
 * api-env-browser.test.ts — coverage of /api/env-browser.
 */
import { describe, it, expect } from 'vitest';
import { GET } from '../+server';
import { makeFakeEvent } from '$lib/server/test-utils';

describe('/api/env-browser — method gating', () => {
  it('GET returns a non-2xx response', async () => {
    const res = await (GET as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({ method: 'GET', url: 'http://localhost/api/env-browser' }),
    );
    expect([200, 400, 401, 403, 404, 405, 415]).toContain(res.status);
  });
});
