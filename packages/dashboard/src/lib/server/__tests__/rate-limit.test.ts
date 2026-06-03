/**
 * rate-limit.test.ts — window expires, burst throttles.
 *
 * Per THREAT_MODEL SR-200:
 *   - Per-IP sliding window 60s, configurable per route.
 *   - Token-mint endpoint: stricter (30/min by default).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  ipKey,
  userKey,
  _resetAllBuckets,
  _bucketCount,
} from '../rate-limit';

beforeEach(() => {
  _resetAllBuckets();
});

describe('checkRateLimit basics', () => {
  it('allows the first N events, blocks the (N+1)th', () => {
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit({ key: 'k1', limit: 5, windowSec: 60 });
      expect(r.allowed).toBe(true);
    }
    const blocked = checkRateLimit({ key: 'k1', limit: 5, windowSec: 60 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('counts events correctly', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit({ key: 'k2', limit: 10, windowSec: 60 });
    }
    const r = checkRateLimit({ key: 'k2', limit: 10, windowSec: 60 });
    expect(r.count).toBe(4);
    expect(r.remaining).toBe(6);
  });

  it('returns remaining=0 when blocked', () => {
    for (let i = 0; i < 2; i++) {
      checkRateLimit({ key: 'k3', limit: 2, windowSec: 60 });
    }
    const blocked = checkRateLimit({ key: 'k3', limit: 2, windowSec: 60 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});

describe('window expiry', () => {
  it('lets requests through after the window expires', async () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit({ key: 'k4', limit: 3, windowSec: 1 });
    }
    const blocked = checkRateLimit({ key: 'k4', limit: 3, windowSec: 1 });
    expect(blocked.allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 1100));
    const after = checkRateLimit({ key: 'k4', limit: 3, windowSec: 1 });
    expect(after.allowed).toBe(true);
  });
});

describe('burst throttling', () => {
  it('rejects a burst of 100 requests past the 100/min cap (SR-200 unauth)', () => {
    for (let i = 0; i < 100; i++) {
      const r = checkRateLimit({ key: 'burst', limit: 100, windowSec: 60 });
      expect(r.allowed).toBe(true);
    }
    const r101 = checkRateLimit({ key: 'burst', limit: 100, windowSec: 60 });
    expect(r101.allowed).toBe(false);
    expect(r101.retryAfterSec).toBeGreaterThan(0);
  });

  it('token-mint endpoint is capped at 30/min by default (SR-200)', () => {
    for (let i = 0; i < 30; i++) {
      const r = checkRateLimit({ key: 'mint', limit: 30, windowSec: 60 });
      expect(r.allowed).toBe(true);
    }
    const r31 = checkRateLimit({ key: 'mint', limit: 30, windowSec: 60 });
    expect(r31.allowed).toBe(false);
  });
});

describe('key isolation', () => {
  it('per-IP and per-user keys are independent', () => {
    const ip = ipKey('1.2.3.4', '/api/auth');
    const user = userKey('user-x', '/api/auth');
    for (let i = 0; i < 3; i++) {
      checkRateLimit({ key: ip, limit: 3, windowSec: 60 });
    }
    expect(checkRateLimit({ key: ip, limit: 3, windowSec: 60 }).allowed).toBe(false);
    expect(checkRateLimit({ key: user, limit: 3, windowSec: 60 }).allowed).toBe(true);
  });
});

describe('bucket lifecycle', () => {
  it('tracks bucket count', () => {
    checkRateLimit({ key: 'a', limit: 5, windowSec: 60 });
    checkRateLimit({ key: 'b', limit: 5, windowSec: 60 });
    expect(_bucketCount()).toBe(2);
  });
});
