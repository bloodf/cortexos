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
  listAudit,
  verifyAuditChain,
  resetAudit,
  auditSize,
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
