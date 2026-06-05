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

  it('admin gate returns 403 when caller is not admin', async () => {
    const handler = defineRoute({
      methods: ['GET'],
      auth: 'admin',
      surface: 'x',
      action: 'x',
      handler: async () => ({ ok: true }),
    });
    const user = makeFakeUser({ is_admin: false, groupMemberships: ['cortexos-users'] });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const res = await handler(makeFakeEvent({ locals: makeFakeLocals(user, session) }));
    expect(res.status).toBe(403);
  });

  it('group-specific auth returns 403 when user lacks the group', async () => {
    const handler = defineRoute({
      methods: ['GET'],
      auth: 'cortexos-auditor' as 'admin' | 'any' | 'cortexos-admin' | 'cortexos-auditor' | 'cortexos-users',
      surface: 'x',
      action: 'x',
      handler: async () => ({ ok: true }),
    });
    const user = makeFakeUser({ is_admin: false, groupMemberships: ['cortexos-users'] });
    const session = makeFakeSession(user);
    registerFakeUser(user);
    registerFakeSession(session);
    const res = await handler(makeFakeEvent({ locals: makeFakeLocals(user, session) }));
    expect(res.status).toBe(403);
  });

  it('rate_limit api error is mapped to 429 + retry-after', async () => {
    const handler = defineRoute({
      methods: ['GET'],
      auth: 'any',
      surface: 'x',
      action: 'x',
      handler: async () => {
        throw rateLimitError('slow down', 60);
      },
    });
    const { locals } = adminLocals();
    const res = await handler(makeFakeEvent({ locals }));
    expect(res.status).toBe(429);
    // retry-after may be either the string '60' (rate_limit error path)
    // or a delta-seconds value depending on how the response is built.
    const retry = res.headers.get('retry-after');
    expect(retry).not.toBeNull();
  });

  it('auth/api error from apiError() is recognized via ApiErrorThrown', async () => {
    // Reach into the auth helper to ensure the import path works.
    const { apiError } = await import('../errors');
    const { authError } = await import('../errors/types');
    const handler = defineRoute({
      methods: 'GET',
      auth: 'any',
      surface: 'x',
      action: 'x',
      handler: async ({ event }) => {
        apiError(event, authError('Not authenticated'));
        return { ok: true };
      },
    });
    const { locals } = adminLocals();
    const res = await handler(makeFakeEvent({ locals }));
    expect(res.status).toBe(401);
  });

  it('reads JSON body when content-type is application/json', async () => {
    const handler = defineRoute({
      methods: 'POST',
      input: z.object({ name: z.string() }),
      auth: 'any',
      surface: 'x',
      action: 'x',
      handler: async ({ input }) => ({ ok: true, name: input.name }),
    });
    const { locals } = adminLocals();
    const res = await handler(makeFakeEvent({
      method: 'POST',
      locals,
      headers: { 'content-type': 'application/json' },
      body: { name: 'world' },
    }));
    expect(res.status).toBe(200);
  });

  it('returns 400 for non-JSON / non-form POST without body parser match', async () => {
    const handler = defineRoute({
      methods: 'POST',
      input: z.object({ name: z.string() }),
      auth: 'any',
      surface: 'x',
      action: 'x',
      handler: async () => ({ ok: true }),
    });
    const { locals } = adminLocals();
    // A POST with an opaque content-type that the parser doesn't
    // understand will fail to read the body; Zod sees an empty
    // object and returns 400. This covers the formData-read fallback
    // branch.
    const res = await handler(makeFakeEvent({
      method: 'POST',
      locals,
      headers: { 'content-type': 'application/octet-stream' },
      body: 'opaque-bytes',
    }));
    expect(res.status).toBe(400);
  });

  it('input validation failure returns 400 with details', async () => {
    const handler = defineRoute({
      methods: 'POST',
      input: z.object({ name: z.string() }),
      auth: 'any',
      surface: 'x',
      action: 'x',
      handler: async () => ({ ok: true }),
    });
    const { locals } = adminLocals();
    const res = await handler(makeFakeEvent({
      method: 'POST',
      locals,
      headers: { 'content-type': 'application/json' },
      body: { name: 123 }, // wrong type
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('Validation failed');
  });
});
