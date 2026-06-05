/**
 * session-store-helpers.test.ts — direct coverage of the
 * module-level helpers in lib/server/auth/session-store.ts:
 * getSessionStore, setSessionStore, resetSessionStore, and
 * generateSessionToken.
 *
 * The DrizzleSessionStore / InMemorySessionStore class methods are
 * covered by the integration tests that exercise the full login
 * → resolve → revoke lifecycle. This file just nails down the
 * helpers that don't fit elsewhere.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSessionStore,
  setSessionStore,
  resetSessionStore,
  generateSessionToken,
  DEFAULT_SESSION_TTL_MS,
  InMemorySessionStore,
} from '../session-store';

beforeEach(() => {
  resetSessionStore();
});

describe('session-store module-level helpers', () => {
  it('getSessionStore returns a non-null store on first call', () => {
    const s = getSessionStore();
    expect(s).toBeDefined();
    expect(typeof s.createSession).toBe('function');
    expect(typeof s.resolveByToken).toBe('function');
    expect(typeof s.touch).toBe('function');
    expect(typeof s.revalidateRole).toBe('function');
    expect(typeof s.gcExpired).toBe('function');
  });

  it('getSessionStore returns the same instance on repeated calls (singleton)', () => {
    const a = getSessionStore();
    const b = getSessionStore();
    expect(a).toBe(b);
  });

  it('setSessionStore replaces the singleton', () => {
    const original = getSessionStore();
    const replacement = new InMemorySessionStore();
    setSessionStore(replacement);
    expect(getSessionStore()).toBe(replacement);
    expect(getSessionStore()).not.toBe(original);
  });

  it('resetSessionStore restores the default (singleton invalidation)', () => {
    const a = getSessionStore();
    resetSessionStore();
    const b = getSessionStore();
    // After reset, a new store is constructed.
    expect(a).not.toBe(b);
  });

  it('generateSessionToken returns a base64url string of the right length', () => {
    const tok = generateSessionToken();
    // 32 random bytes -> 43 base64url chars (no padding).
    expect(tok).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('generateSessionToken returns a unique value each call', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seen.add(generateSessionToken());
    }
    expect(seen.size).toBe(100);
  });

  it('DEFAULT_SESSION_TTL_MS is 30 days', () => {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(DEFAULT_SESSION_TTL_MS).toBe(thirtyDaysMs);
  });
});
