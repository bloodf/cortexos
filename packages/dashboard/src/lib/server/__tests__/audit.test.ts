/**
 * audit.test.ts — chain integrity, hash verification.
 *
 * Per THREAT_MODEL §6.4.1:
 *   - First row has prev_hash = null
 *   - Subsequent rows have prev_hash = sha256(prev.id || prev.payload_hash || prev.ts_micros || prev_running_hash)
 *   - verifyAuditChain() returns { ok: true, length } when intact
 *   - Tampering → first failure index reported
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  audit,
  resetAudit,
  listAudit,
  auditSize,
  _runningHashForTests,
  _expectedRunningHashAt,
  verifyAuditChain,
} from '../audit';
import { asUserId, asSessionId } from '../entities';

beforeEach(() => {
  resetAudit();
});

describe('audit append', () => {
  it('writes the first row with prevHash=null', () => {
    const row = audit({
      actorUserId: asUserId('u1'),
      actorSessionId: asSessionId('s1'),
      actorIp: '127.0.0.1',
      actorUserAgent: 'test',
      surface: 'services',
      action: 'services.list',
      target: null,
      result: 'success',
      errorCode: null,
      payload: { a: 1 },
    });
    expect(row.prevHash).toBeNull();
    expect(auditSize()).toBe(1);
  });

  it('writes subsequent rows with non-null prevHash', () => {
    audit({
      actorUserId: asUserId('u1'),
      actorSessionId: null,
      actorIp: null,
      actorUserAgent: null,
      surface: 'services',
      action: 'services.list',
      target: null,
      result: 'success',
      errorCode: null,
      payload: { a: 1 },
    });
    const row2 = audit({
      actorUserId: asUserId('u1'),
      actorSessionId: null,
      actorIp: null,
      actorUserAgent: null,
      surface: 'services',
      action: 'services.create',
      target: 'svc1',
      result: 'success',
      errorCode: null,
      payload: { b: 2 },
    });
    expect(row2.prevHash).not.toBeNull();
    expect(auditSize()).toBe(2);
  });
});

describe('verifyAuditChain', () => {
  it('verifies a single-row chain', () => {
    audit({
      actorUserId: null,
      actorSessionId: null,
      actorIp: null,
      actorUserAgent: null,
      surface: 'x',
      action: 'a',
      target: null,
      result: 'success',
      errorCode: null,
      payload: { v: 1 },
    });
    const v = verifyAuditChain();
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.length).toBe(1);
  });

  it('verifies a multi-row chain', () => {
    for (let i = 0; i < 5; i++) {
      audit({
        actorUserId: null,
        actorSessionId: null,
        actorIp: null,
        actorUserAgent: null,
        surface: 'x',
        action: `a${i}`,
        target: null,
        result: 'success',
        errorCode: null,
        payload: { i },
      });
    }
    const v = verifyAuditChain();
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.length).toBe(5);
  });

  it('detects tampering: changing prevHash breaks the chain', () => {
    for (let i = 0; i < 3; i++) {
      audit({
        actorUserId: null,
        actorSessionId: null,
        actorIp: null,
        actorUserAgent: null,
        surface: 'x',
        action: `a${i}`,
        target: null,
        result: 'success',
        errorCode: null,
        payload: { i },
      });
    }
    // Tamper with row 1's prevHash — this is what the chain verifier
    // walks. (Payload tampering is detected at the DB layer in M3
    // via payloadHash recomputation; the in-memory chain only tracks
    // prevHash links.)
    const events = listAudit() as unknown as { prevHash: string | null }[];
    events[1]!.prevHash = '0'.repeat(64);

    const v = verifyAuditChain();
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.index).toBe(1);
    }
  });
});

describe('payload hash stability', () => {
  it('is order-independent (sorted keys)', () => {
    audit({
      actorUserId: null,
      actorSessionId: null,
      actorIp: null,
      actorUserAgent: null,
      surface: 'x',
      action: 'a',
      target: null,
      result: 'success',
      errorCode: null,
      payload: { a: 1, b: 2, c: 3 },
    });
    audit({
      actorUserId: null,
      actorSessionId: null,
      actorIp: null,
      actorUserAgent: null,
      surface: 'x',
      action: 'a',
      target: null,
      result: 'success',
      errorCode: null,
      payload: { c: 3, b: 2, a: 1 },
    });
    const [r1, r2] = listAudit();
    expect(r1!.payloadHash).toBe(r2!.payloadHash);
  });
});

describe('audit internals — extras', () => {
  beforeEach(() => {
    resetAudit();
  });

  it('_runningHashForTests returns the current GENESIS before any audit', () => {
    // Before any audit, the running hash is the GENESIS sentinel.
    // We don't assert the exact value (it would be the SHA-256 of
    // "cortexos:audit:genesis:v1" hex-encoded) — just that the
    // helper is callable and returns a 64-char hex string.
    const h = _runningHashForTests();
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('_expectedRunningHashAt throws for negative index', () => {
    expect(() => _expectedRunningHashAt(-1)).toThrow(/out of range/);
  });

  it('_expectedRunningHashAt throws for index >= events.length', () => {
    audit({
      actorUserId: null,
      actorSessionId: null,
      actorIp: null,
      actorUserAgent: null,
      surface: 's',
      action: 'a',
      target: null,
      result: 'success',
      errorCode: null,
      payload: {},
    });
    expect(auditSize()).toBe(1);
    expect(() => _expectedRunningHashAt(1)).toThrow(/out of range/);
    expect(() => _expectedRunningHashAt(99)).toThrow(/out of range/);
  });

  it('_expectedRunningHashAt returns the correct hash for valid index', () => {
    audit({
      actorUserId: null,
      actorSessionId: null,
      actorIp: null,
      actorUserAgent: null,
      surface: 's',
      action: 'a',
      target: null,
      result: 'success',
      errorCode: null,
      payload: { i: 0 },
    });
    const h = _expectedRunningHashAt(0);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    // The hash must equal the running hash after one event.
    expect(h).toBe(_runningHashForTests());
  });
});
