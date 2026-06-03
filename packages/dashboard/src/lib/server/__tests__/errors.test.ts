/**
 * errors.test.ts — 1+ test per error type.
 *
 * Covers:
 *   - validation → 400 with field-level details
 *   - auth → 401
 *   - permission → 403
 *   - not_found → 404
 *   - rate_limit → 429 + Retry-After header
 *   - approval_required → 403 + X-Cortex-* headers
 *   - system → 500
 */

import { describe, it, expect } from 'vitest';
import { apiError, jsonError, httpStatusFor, errorBody, ApiErrorThrown } from '../errors';
import {
  isApiError,
  validationError,
  authError,
  permissionError,
  notFoundError,
  rateLimitError,
  approvalRequiredError,
  systemError,
  type ApiError,
} from '../errors/types';
import { makeFakeEvent } from '../test-utils';

describe('httpStatusFor', () => {
  it('maps validation to 400', () => {
    expect(httpStatusFor(validationError('x'))).toBe(400);
  });
  it('maps auth to 401', () => {
    expect(httpStatusFor(authError())).toBe(401);
  });
  it('maps permission to 403', () => {
    expect(httpStatusFor(permissionError())).toBe(403);
  });
  it('maps not_found to 404', () => {
    expect(httpStatusFor(notFoundError())).toBe(404);
  });
  it('maps rate_limit to 429', () => {
    expect(httpStatusFor(rateLimitError(60))).toBe(429);
  });
  it('maps approval_required to 403', () => {
    expect(httpStatusFor(approvalRequiredError('hash', 60))).toBe(403);
  });
  it('maps system to 500', () => {
    expect(httpStatusFor(systemError('boom'))).toBe(500);
  });
});

describe('errorBody', () => {
  it('includes field details for validation', () => {
    const e = validationError('bad', [{ field: 'name', message: 'required' }]);
    const body = errorBody(e);
    expect(body.message).toBe('bad');
    expect(body.code).toBe('validation');
    expect(body.details).toEqual([{ field: 'name', message: 'required' }]);
  });
  it('includes action hash + ttl for approval_required', () => {
    const e = approvalRequiredError('hash-abc', 120);
    const body = errorBody(e);
    expect(body.code).toBe('approval_required');
    expect(body.actionHash).toBe('hash-abc');
    expect(body.ttlSec).toBe(120);
  });
});

describe('isApiError', () => {
  it('returns true for ApiError instances', () => {
    expect(isApiError(validationError('x'))).toBe(true);
    expect(isApiError(authError())).toBe(true);
  });
  it('returns false for plain Error', () => {
    expect(isApiError(new Error('boom'))).toBe(false);
  });
  it('returns false for null/undefined/string', () => {
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
    expect(isApiError('x')).toBe(false);
  });
});

describe('apiError', () => {
  it('throws ApiErrorThrown with the right status for each kind', () => {
    const event = makeFakeEvent();
    const cases: ReadonlyArray<[ApiError, number]> = [
      [validationError('x'), 400],
      [authError(), 401],
      [permissionError(), 403],
      [notFoundError(), 404],
      [rateLimitError(60), 429],
      [approvalRequiredError('h', 60), 403],
      [systemError('x'), 500],
    ];
    for (const [err, status] of cases) {
      try {
        apiError(event, err);
        expect.fail('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiErrorThrown);
        expect((e as ApiErrorThrown).status).toBe(status);
      }
    }
  });
});

describe('jsonError', () => {
  it('returns 400 with field details for validation', async () => {
    const res = jsonError(validationError('bad', [{ field: 'x', message: 'm' }]));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string; code: string; details: unknown };
    expect(body.code).toBe('validation');
    expect(body.details).toEqual([{ field: 'x', message: 'm' }]);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns 429 with Retry-After for rate_limit', async () => {
    const res = jsonError(rateLimitError(42));
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
  });

  it('returns 403 with X-Cortex-* headers for approval_required', async () => {
    const res = jsonError(approvalRequiredError('h-xyz', 60));
    expect(res.status).toBe(403);
    expect(res.headers.get('x-cortex-confirmation-token-required')).toBe('true');
    expect(res.headers.get('x-cortex-approval-action-hash')).toBe('h-xyz');
    expect(res.headers.get('x-cortex-approval-ttl-sec')).toBe('60');
  });

  it('returns 500 for system errors', async () => {
    const res = jsonError(systemError('boom'));
    expect(res.status).toBe(500);
  });
});
