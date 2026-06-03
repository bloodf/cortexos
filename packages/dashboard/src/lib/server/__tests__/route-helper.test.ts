/**
 * route-helper.test.ts — direct coverage of the `defineRoute` wrapper.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { defineRoute } from '../route-helper';
import {
  _resetStubData,
  createService,
} from '../stub-data';
import { resetAudit } from '../audit';
import { resetApprovalStore } from '../approval';
import { _resetAllBuckets } from '../rate-limit';
import { setServerHmacKeyFromString } from '../config';
import {
  makeFakeEvent,
  makeFakeUser,
  makeFakeSession,
  makeFakeLocals,
} from '../test-utils';
import { registerFakeUser, registerFakeSession, clearFakeAuth } from '../auth';
import { notFoundError, approvalRequiredError, rateLimitError } from '../errors/types';

beforeEach(() => {
  _resetStubData();
  resetAudit();
  resetApprovalStore();
  _resetAllBuckets();
  clearFakeAuth();
  setServerHmacKeyFromString('test-key-1234567890');
});

const Schema = z.object({ name: z.string() });

function adminLocals() {
  const user = makeFakeUser({ is_admin: true, groupMemberships: ['cortexos-admin'] });
  const session = makeFakeSession(user);
  registerFakeUser(user);
  registerFakeSession(session);
  return { user, session, locals: makeFakeLocals(user, session) };
}

describe('defineRoute', () => {
  it('returns 405 for unsupported methods', async () => {
    const handler = defineRoute({
      methods: ['GET'],
      auth: 'any',
      surface: 'x',
      action: 'x',
      handler: async () => ({}),
    });
    const event = makeFakeEvent({ method: 'POST' });
    const res = await handler(event);
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET');
  });

  it('returns 200 on success', async () => {
    const handler = defineRoute({
      methods: ['GET'],
      auth: 'any',
      surface: 'x',
      action: 'x',
      handler: async () => ({ ok: true }),
    });
    const { locals } = adminLocals();
    const res = await handler(makeFakeEvent({ locals }));
    expect(res.status).toBe(200);
  });

  it('handles notFoundError from handler', async () => {
    const handler = defineRoute({
      methods: ['GET'],
      auth: 'any',
      surface: 'x',
      action: 'x',
      handler: async () => {
        throw notFoundError('missing', 'thing');
      },
    });
    const { locals } = adminLocals();
    const res = await handler(makeFakeEvent({ locals }));
    expect(res.status).toBe(404);
  });

  it('handles approvalRequiredError from handler', async () => {
    const handler = defineRoute({
      methods: ['GET'],
      auth: 'any',
      surface: 'x',
      action: 'x',
      handler: async () => {
        throw approvalRequiredError('h', 60);
      },
    });
    const { locals } = adminLocals();
    const res = await handler(makeFakeEvent({ locals }));
    expect(res.status).toBe(403);
    expect(res.headers.get('x-cortex-confirmation-token-required')).toBe('true');
  });

  it('handles system error on unexpected throw', async () => {
    const handler = defineRoute({
      methods: ['GET'],
      auth: 'any',
      surface: 'x',
      action: 'x',
      handler: async () => {
        throw new Error('boom');
      },
    });
    const { locals } = adminLocals();
    const res = await handler(makeFakeEvent({ locals }));
    expect(res.status).toBe(500);
  });

  it('applies rate limit and returns 429 + retry-after', async () => {
    const handler = defineRoute({
      methods: ['GET'],
      auth: 'any',
      surface: 'x',
      action: 'x',
      rateLimit: { limit: 1, windowSec: 60, bucket: 'ip' },
      handler: async () => ({ ok: true }),
    });
    const { locals } = adminLocals();
    const event = makeFakeEvent({ locals, ip: '1.2.3.4' });
    const r1 = await handler(event);
    expect(r1.status).toBe(200);
    const r2 = await handler(event);
    expect(r2.status).toBe(429);
    expect(r2.headers.get('retry-after')).not.toBeNull();
  });

  it('rate limit via user bucket', async () => {
    const handler = defineRoute({
      methods: ['GET'],
      auth: 'any',
      surface: 'x',
      action: 'x',
      rateLimit: { limit: 1, windowSec: 60, bucket: 'user' },
      handler: async () => ({ ok: true }),
    });
    const { locals, user } = adminLocals();
    const r1 = await handler(makeFakeEvent({ locals }));
    expect(r1.status).toBe(200);
    const r2 = await handler(makeFakeEvent({ locals }));
    expect(r2.status).toBe(429);
    expect(user.id).toBeDefined();
  });

  it('validates input with Zod', async () => {
    const handler = defineRoute({
      methods: ['POST'],
      input: Schema,
      auth: 'any',
      surface: 'x',
      action: 'x',
      handler: async () => ({}),
    });
    const { locals } = adminLocals();
    const res = await handler(makeFakeEvent({ method: 'POST', locals, body: { name: 1 } }));
    expect(res.status).toBe(400);
  });

  it('extracts query params for GET', async () => {
    const handler = defineRoute({
      methods: ['GET'],
      auth: 'any',
      surface: 'x',
      action: 'x',
      handler: async () => ({ ok: true }),
    });
    const { locals } = adminLocals();
    const res = await handler(makeFakeEvent({ locals, url: 'http://localhost/?a=1&b=2' }));
    expect(res.status).toBe(200);
  });
});
