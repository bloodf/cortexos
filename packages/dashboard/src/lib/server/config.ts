/**
 * Server-side config — session cookie names, HMAC keys, defaults.
 *
 * In M3 this is replaced with values sourced from `.secrets/cortexos.env` and
 * the database. For M1 the values are in-memory and can be overridden by env
 * vars in tests.
 */

import { randomBytes } from 'node:crypto';

/** Session cookie name (THREAT_MODEL SR-001). */
export const SESSION_COOKIE = 'cortexos_session';

/** CSRF cookie name (double-submit pattern, THREAT_MODEL SR-004). */
export const CSRF_COOKIE = 'cortexos_csrf';

/** Default approval-token TTL in seconds (THREAT_MODEL §3.5). */
export const APPROVAL_DEFAULT_TTL_SEC = 60;

/** Reveal-token TTL is longer because the user is reading (THREAT_MODEL §3.5). */
export const APPROVAL_REVEAL_TTL_SEC = 300;

/** Default rate-limit window (seconds) — applies to per-IP and per-user buckets. */
export const RATE_LIMIT_DEFAULT_WINDOW_SEC = 60;

/** Stricter default for token-mint endpoints (THREAT_MODEL SR-200). */
export const RATE_LIMIT_TOKEN_MINT_PER_60S = 30;

/** Looser default for general unauth endpoints (THREAT_MODEL SR-200). */
export const RATE_LIMIT_UNAUTH_PER_60S = 100;

/** Strict default for authenticated privileged ops. */
export const RATE_LIMIT_AUTH_PRIVILEGED_PER_60S = 10;

/**
 * HMAC key used to sign audit-chain hashes and approval tokens.
 *
 * Generated at process start. In M3 this is loaded from `.secrets/`.
 * Stable per-process; tests can override via `setServerHmacKey()`.
 */
let serverHmacKey: Buffer = randomBytes(32);

export function getServerHmacKey(): Buffer {
  return serverHmacKey;
}

export function setServerHmacKey(key: Buffer): void {
  if (key.length < 16) {
    throw new Error('HMAC key must be at least 16 bytes');
  }
  serverHmacKey = key;
}

/** Convenience for tests: derive a deterministic key from a string. */
export function setServerHmacKeyFromString(s: string): void {
  setServerHmacKey(Buffer.from(s, 'utf8'));
}
