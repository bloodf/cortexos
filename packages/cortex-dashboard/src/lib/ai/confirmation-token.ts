/**
 * confirmation-token.ts
 * HMAC-SHA256 confirmation tokens for privileged/destructive tool calls.
 * Plan §4a: issue → UI echo → verify → execute.
 *
 * TODO: swap InMemoryConsumedStore for a durable approval store before
 * multi-worker deployment. The durable put must provide cross-process
 * atomicity; the in-memory store
 * is single-process only and has a TOCTOU window under concurrent load.
 */

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Secret resolution
// ---------------------------------------------------------------------------

function resolveSecret(): string {
  const s = process.env.CORTEX_CONFIRMATION_HMAC_SECRET;
  if (s) return s;
  // L-4: NODE_ENV=test alone is not enough — a leaky Docker layer could ship
  // production with NODE_ENV=test. Require an additional test-runner marker.
  const inTestRunner =
    process.env.NODE_ENV === 'test' &&
    (process.env.VITEST === 'true' ||
      process.env.VITEST_WORKER_ID !== undefined ||
      process.env.JEST_WORKER_ID !== undefined);
  if (inTestRunner) return 'test-only-insecure-secret-do-not-use';
  throw new Error('CORTEX_CONFIRMATION_HMAC_SECRET is required in production');
}

// Lazy resolution: throwing at module load breaks Next.js build-time page data
// collection. Resolve on first use instead.
let HMAC_SECRET: string | null = null;
let HMAC_SECRET_OVERRIDDEN = false;

function getHmacSecret(): string {
  if (HMAC_SECRET_OVERRIDDEN && HMAC_SECRET !== null) return HMAC_SECRET;
  if (HMAC_SECRET === null) HMAC_SECRET = resolveSecret();
  return HMAC_SECRET;
}

/** Replace the HMAC secret at runtime. Test-use only. */
export function _setHmacSecret(secret: string): void {
  HMAC_SECRET = secret;
  HMAC_SECRET_OVERRIDDEN = true;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IssueInput = {
  sessionId: string;
  toolName: string;
  toolClass: 'privileged' | 'destructive';
  argsHash: string;
  userId: number;
  ttlMs?: number;
};

export type IssuedToken = {
  token: string;      // base64url: hmac.nonce.expiresMs.approvalId
  nonce: string;      // hex, 16 bytes
  approvalId: string; // uuid v4
  expiresAt: Date;
};

export type VerifyInput = {
  token: string;
  sessionId: string;
  toolName: string;
  argsHash: string;
  /**
   * Authenticated user id. Required: the HMAC payload binds the token to a
   * specific user so a leaked sessionId alone cannot replay across users.
   */
  userId: number;
};

export type VerifyResult =
  | { ok: true; approvalId: string }
  | { ok: false; reason: 'mismatch' | 'expired' | 'consumed' | 'malformed' | 'unknown' };

// ---------------------------------------------------------------------------
// TokenConsumedStore interface
// ---------------------------------------------------------------------------

export interface TokenConsumedStore {
  has(token: string): Promise<boolean>;
  add(token: string, expiresAt: Date): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory default implementation (single-process only)
// TTL eviction: sweep runs every SWEEP_INTERVAL_MS; entries expire at expiresAt.
// ---------------------------------------------------------------------------

const SWEEP_INTERVAL_MS = 60_000;

class InMemoryConsumedStore implements TokenConsumedStore {
  private readonly store = new Map<string, number>(); // token → expiresAt unix ms
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS).unref();
  }

  async has(token: string): Promise<boolean> {
    const exp = this.store.get(token);
    if (exp === undefined) return false;
    if (Date.now() > exp) { this.store.delete(token); return false; }
    return true;
  }

  async add(token: string, expiresAt: Date): Promise<void> {
    this.store.set(token, expiresAt.getTime());
  }

  private sweep(): void {
    const now = Date.now();
    for (const [k, exp] of this.store) {
      if (now > exp) this.store.delete(k);
    }
  }

  /** Teardown for tests. */
  destroy(): void {
    if (this.sweepTimer) { clearInterval(this.sweepTimer); this.sweepTimer = null; }
    this.store.clear();
  }
}

let consumedStore: TokenConsumedStore = new InMemoryConsumedStore();

/** Inject alternative store (JetStream KV, test doubles). */
export function setTokenConsumedStore(impl: TokenConsumedStore): void {
  consumedStore = impl;
}

// ---------------------------------------------------------------------------
// Pipe-guard
// ---------------------------------------------------------------------------

function assertNoPipe(...fields: string[]): void {
  for (const f of fields) {
    if (f.includes('|')) throw Object.assign(new Error('Field contains pipe character'), { code: 'MALFORMED' });
  }
}

// ---------------------------------------------------------------------------
// HMAC helpers
// ---------------------------------------------------------------------------

function hmacHex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message, 'utf8').digest('hex');
}

function canonicalMessage(
  userId: number,
  sessionId: string,
  toolName: string,
  argsHash: string,
  nonce: string,
  expiresAtIso: string,
): string {
  return `${userId}|${sessionId}|${toolName}|${argsHash}|${nonce}|${expiresAtIso}`;
}

function toBase64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}

function fromBase64url(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8');
}

// ---------------------------------------------------------------------------
// issueConfirmationToken
// ---------------------------------------------------------------------------

export function issueConfirmationToken(input: IssueInput): IssuedToken {
  const { sessionId, toolName, argsHash, userId, ttlMs = 5 * 60 * 1000 } = input;

  if (!Number.isInteger(userId) || userId <= 0) {
    throw Object.assign(new Error('userId must be a positive integer'), { code: 'MALFORMED' });
  }
  assertNoPipe(sessionId, toolName, argsHash);

  const nonce = randomBytes(16).toString('hex');
  const approvalId = randomUUID();
  const expiresAt = new Date(Date.now() + ttlMs);
  const expiresAtIso = expiresAt.toISOString();

  const mac = hmacHex(
    getHmacSecret(),
    canonicalMessage(userId, sessionId, toolName, argsHash, nonce, expiresAtIso),
  );
  const payload = `${mac}.${nonce}.${expiresAt.getTime()}.${approvalId}`;
  const token = toBase64url(payload);

  return { token, nonce, approvalId, expiresAt };
}

// ---------------------------------------------------------------------------
// verifyAndConsume
// ---------------------------------------------------------------------------

export async function verifyAndConsume(input: VerifyInput): Promise<VerifyResult> {
  const { token, sessionId, toolName, argsHash, userId } = input;

  if (!Number.isInteger(userId) || userId <= 0) {
    return { ok: false, reason: 'malformed' };
  }

  // Decode token
  let payload: string;
  try {
    payload = fromBase64url(token);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const parts = payload.split('.');
  if (parts.length !== 4) return { ok: false, reason: 'malformed' };

  const [mac, nonce, expMsStr, approvalId] = parts;
  if (!mac || !nonce || !expMsStr || !approvalId) return { ok: false, reason: 'malformed' };

  const expMs = Number(expMsStr);
  if (!Number.isFinite(expMs)) return { ok: false, reason: 'malformed' };

  // Check consumed first (before crypto — avoids pointless work on replays)
  try {
    if (await consumedStore.has(token)) return { ok: false, reason: 'consumed' };
  } catch (err) {
    // L-2: structured stderr so operators can distinguish "store down" from "client wrong".
    process.stderr.write(
      `[confirmation-token] consumed-store has() failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return { ok: false, reason: 'unknown' };
  }

  // Verify HMAC
  const expiresAtIso = new Date(expMs).toISOString();
  try {
    assertNoPipe(sessionId, toolName, argsHash, nonce, expiresAtIso);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const expected = hmacHex(
    getHmacSecret(),
    canonicalMessage(userId, sessionId, toolName, argsHash, nonce, expiresAtIso),
  );

  const macBuf = Buffer.from(mac, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (macBuf.length !== expBuf.length || !timingSafeEqual(macBuf, expBuf)) {
    return { ok: false, reason: 'mismatch' };
  }

  // TTL check
  if (Date.now() > expMs) return { ok: false, reason: 'expired' };

  // Consume
  try {
    await consumedStore.add(token, new Date(expMs));
  } catch (err) {
    // L-2: structured stderr so operators can distinguish "store down" from "client wrong".
    process.stderr.write(
      `[confirmation-token] consumed-store add() failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return { ok: false, reason: 'unknown' };
  }

  return { ok: true, approvalId };
}
