import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  issueConfirmationToken,
  verifyAndConsume,
  setTokenConsumedStore,
  _setHmacSecret,
  type TokenConsumedStore,
  type IssueInput,
} from '../confirmation-token';

// NODE_ENV is already 'test' in vitest; just set the secret.
process.env.CORTEX_CONFIRMATION_HMAC_SECRET = 'test-secret-abc123';

// Fresh in-memory store per test
const makeStore = (): TokenConsumedStore => {
  const m = new Map<string, number>();
  return {
    async has(token) {
      const exp = m.get(token);
      if (exp === undefined) return false;
      if (Date.now() > exp) { m.delete(token); return false; }
      return true;
    },
    async add(token, expiresAt) { m.set(token, expiresAt.getTime()); },
  };
};

const USER_ID = 42;

const baseInput = (): IssueInput => ({
  sessionId: 'sess-abc',
  toolName: 'docker.restart',
  toolClass: 'destructive',
  argsHash: 'a'.repeat(64),
  userId: USER_ID,
});

beforeEach(() => {
  _setHmacSecret('test-secret-abc123');
  setTokenConsumedStore(makeStore());
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe('issueConfirmationToken + verifyAndConsume', () => {
  it('happy path: issue → verify → ok', async () => {
    const issued = issueConfirmationToken(baseInput());
    const result = await verifyAndConsume({
      token: issued.token,
      sessionId: 'sess-abc',
      toolName: 'docker.restart',
      argsHash: 'a'.repeat(64),
      userId: USER_ID,
    });
    expect(result).toEqual({ ok: true, approvalId: issued.approvalId });
  });

  it('wrong sessionId → mismatch', async () => {
    const issued = issueConfirmationToken(baseInput());
    const result = await verifyAndConsume({
      token: issued.token,
      sessionId: 'sess-WRONG',
      toolName: 'docker.restart',
      argsHash: 'a'.repeat(64),
      userId: USER_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('wrong argsHash → mismatch', async () => {
    const issued = issueConfirmationToken(baseInput());
    const result = await verifyAndConsume({
      token: issued.token,
      sessionId: 'sess-abc',
      toolName: 'docker.restart',
      argsHash: 'b'.repeat(64),
      userId: USER_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('wrong toolName → mismatch', async () => {
    const issued = issueConfirmationToken(baseInput());
    const result = await verifyAndConsume({
      token: issued.token,
      sessionId: 'sess-abc',
      toolName: 'docker.stop',
      argsHash: 'a'.repeat(64),
      userId: USER_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('wrong userId → mismatch (cross-user replay blocked)', async () => {
    const issued = issueConfirmationToken(baseInput());
    const result = await verifyAndConsume({
      token: issued.token,
      sessionId: 'sess-abc',
      toolName: 'docker.restart',
      argsHash: 'a'.repeat(64),
      userId: USER_ID + 1,
    });
    expect(result).toEqual({ ok: false, reason: 'mismatch' });
  });
});

// ---------------------------------------------------------------------------
// TTL
// ---------------------------------------------------------------------------

describe('TTL', () => {
  it('past TTL → expired', async () => {
    vi.useFakeTimers();
    const issued = issueConfirmationToken({ ...baseInput(), ttlMs: 1_000 });

    vi.advanceTimersByTime(2_000);

    const result = await verifyAndConsume({
      token: issued.token,
      sessionId: 'sess-abc',
      toolName: 'docker.restart',
      argsHash: 'a'.repeat(64),
      userId: USER_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });
});

// ---------------------------------------------------------------------------
// Single-use
// ---------------------------------------------------------------------------

describe('single-use', () => {
  it('second verify → consumed', async () => {
    const issued = issueConfirmationToken(baseInput());
    const verify = () =>
      verifyAndConsume({
        token: issued.token,
        sessionId: 'sess-abc',
        toolName: 'docker.restart',
        argsHash: 'a'.repeat(64),
        userId: USER_ID,
      });

    const first = await verify();
    expect(first.ok).toBe(true);

    const second = await verify();
    expect(second).toEqual({ ok: false, reason: 'consumed' });
  });
});

// ---------------------------------------------------------------------------
// Malformed input
// ---------------------------------------------------------------------------

describe('malformed', () => {
  it('bad base64 → malformed', async () => {
    const result = await verifyAndConsume({
      token: '!!!not-base64url!!!',
      sessionId: 'sess-abc',
      toolName: 'docker.restart',
      argsHash: 'a'.repeat(64),
      userId: USER_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'malformed' });
  });

  it('valid base64 but wrong segment count → malformed', async () => {
    const token = Buffer.from('only.two').toString('base64url');
    const result = await verifyAndConsume({
      token,
      sessionId: 'sess-abc',
      toolName: 'docker.restart',
      argsHash: 'a'.repeat(64),
      userId: USER_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'malformed' });
  });

  it('missing/invalid userId → malformed', async () => {
    const issued = issueConfirmationToken(baseInput());
    const result = await verifyAndConsume({
      token: issued.token,
      sessionId: 'sess-abc',
      toolName: 'docker.restart',
      argsHash: 'a'.repeat(64),
      userId: 0,
    });
    expect(result).toEqual({ ok: false, reason: 'malformed' });
  });
});

// ---------------------------------------------------------------------------
// Tampered HMAC byte
// ---------------------------------------------------------------------------

describe('tampered HMAC', () => {
  it('flip one nibble in mac segment → mismatch', async () => {
    const issued = issueConfirmationToken(baseInput());
    const raw = Buffer.from(issued.token, 'base64url').toString('utf8');
    const [mac, ...rest] = raw.split('.');
    // Flip last char of mac hex
    const flipped = mac.slice(0, -1) + (mac.endsWith('0') ? '1' : '0');
    const tampered = Buffer.from([flipped, ...rest].join('.')).toString('base64url');

    const result = await verifyAndConsume({
      token: tampered,
      sessionId: 'sess-abc',
      toolName: 'docker.restart',
      argsHash: 'a'.repeat(64),
      userId: USER_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'mismatch' });
  });
});

// ---------------------------------------------------------------------------
// Nonce uniqueness
// ---------------------------------------------------------------------------

describe('nonce uniqueness', () => {
  it('two issues with same args produce different tokens', () => {
    const a = issueConfirmationToken(baseInput());
    const b = issueConfirmationToken(baseInput());
    expect(a.token).not.toBe(b.token);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.approvalId).not.toBe(b.approvalId);
  });
});

// ---------------------------------------------------------------------------
// Different HMAC secret
// ---------------------------------------------------------------------------

describe('HMAC secret rotation', () => {
  it('token issued under secret-A fails verification under secret-B', async () => {
    _setHmacSecret('secret-A');
    const issued = issueConfirmationToken(baseInput());

    _setHmacSecret('secret-B');
    const result = await verifyAndConsume({
      token: issued.token,
      sessionId: 'sess-abc',
      toolName: 'docker.restart',
      argsHash: 'a'.repeat(64),
      userId: USER_ID,
    });
    expect(result).toEqual({ ok: false, reason: 'mismatch' });
  });
});
