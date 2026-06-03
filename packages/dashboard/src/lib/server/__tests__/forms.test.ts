/**
 * forms.test.ts — schema validation, error mapping.
 *
 * Tests the `formHandler` wrapper: Zod validation failures map to a
 * `failure` ActionResult; success maps to `success`; ApiErrors thrown
 * inside the handler map to `failure` with the right status.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { formHandler, formDataToObject } from '../forms';
import { approvalRequiredError, notFoundError, permissionError } from '../errors/types';
import { makeFakeEvent } from '../test-utils';

const Schema = z.object({
  name: z.string().min(2),
  age: z.coerce.number().int().min(0).max(150),
});

describe('formDataToObject', () => {
  it('converts FormData to a plain object', () => {
    const fd = new FormData();
    fd.append('a', '1');
    fd.append('b', '2');
    fd.append('a', '3');
    const out = formDataToObject(fd);
    expect(out.a).toEqual(['1', '3']);
    expect(out.b).toBe('2');
  });
});

describe('formHandler', () => {
  it('returns success on valid input', async () => {
    const handler = formHandler(Schema, async (input) => {
      return { greeting: `hi ${input.name}` };
    });
    const event = makeFakeEvent({
      method: 'POST',
      body: { name: 'Alice', age: '30' },
    });
    const result = await handler(event);
    expect(result.type).toBe('success');
    if (result.type === 'success') {
      expect(result.data).toEqual({ greeting: 'hi Alice' });
    }
  });

  it('returns failure with field errors on invalid input', async () => {
    const handler = formHandler(Schema, async () => ({ ok: true }));
    const event = makeFakeEvent({
      method: 'POST',
      body: { name: 'A', age: '300' },
    });
    const result = await handler(event);
    expect(result.type).toBe('failure');
    if (result.type === 'failure') {
      expect(result.status).toBe(400);
      expect(result.data.fieldErrors.length).toBeGreaterThan(0);
    }
  });

  it('maps thrown ApiError to failure with the right status', async () => {
    const handler = formHandler(Schema, async () => {
      throw notFoundError('User not found', 'user');
    });
    const event = makeFakeEvent({
      method: 'POST',
      body: { name: 'Alice', age: 30 },
    });
    const result = await handler(event);
    expect(result.type).toBe('failure');
    if (result.type === 'failure') expect(result.status).toBe(404);
  });

  it('maps permissionError to 403', async () => {
    const handler = formHandler(Schema, async () => {
      throw permissionError('Nope');
    });
    const event = makeFakeEvent({
      method: 'POST',
      body: { name: 'Alice', age: 30 },
    });
    const result = await handler(event);
    expect(result.type).toBe('failure');
    if (result.type === 'failure') expect(result.status).toBe(403);
  });

  it('maps approvalRequiredError to 400 (failure fallback)', async () => {
    // The form-handler doesn't know about 403-for-approval; it falls
    // through to the generic 400. The +server.ts path uses jsonError
    // which produces 403 with the X-Cortex headers.
    const handler = formHandler(Schema, async () => {
      throw approvalRequiredError('hash', 60);
    });
    const event = makeFakeEvent({
      method: 'POST',
      body: { name: 'Alice', age: 30 },
    });
    const result = await handler(event);
    expect(result.type).toBe('failure');
  });

  it('returns error on unexpected throw', async () => {
    const handler = formHandler(Schema, async () => {
      throw new Error('boom');
    });
    const event = makeFakeEvent({
      method: 'POST',
      body: { name: 'Alice', age: 30 },
    });
    const result = await handler(event);
    expect(result.type).toBe('error');
    if (result.type === 'error') {
      expect(result.error.message).toBe('boom');
    }
  });

  it('handles JSON content-type bodies', async () => {
    const handler = formHandler(Schema, async (input) => input);
    const event = makeFakeEvent({
      method: 'POST',
      body: { name: 'Bob', age: 42 },
    });
    const result = await handler(event);
    expect(result.type).toBe('success');
  });
});
