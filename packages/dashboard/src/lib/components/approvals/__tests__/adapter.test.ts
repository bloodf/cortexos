/**
 * adapter.test.ts — unit tests for the approvals adapter.
 *
 * Covers:
 *   - adaptApproval derives `status` from `decision` + `timeoutAt`
 *   - `expiredByTimeout` is true when timeoutAt is in the past
 *   - `actionable` is true only for `pending` + `expired`
 *   - filterByStatus / filterByAgeBucket / filterByQuery narrow correctly
 *   - formatAge emits `1h 23m` / `5m` / `12s`
 *   - bucketFor returns the right age bucket
 *   - statusToI18nKey maps every status to a valid i18n key
 */
import { describe, it, expect } from 'vitest';
import {
  adaptApproval,
  adaptApprovalList,
  bucketFor,
  filterByAgeBucket,
  filterByQuery,
  filterByStatus,
  formatAge,
  statusToI18nKey,
  type Approval,
} from '../adapter';
import type { PendingApproval } from '$lib/server/entities';
import { asApprovalTokenId } from '$lib/server/entities';

const REF = Date.parse('2026-06-03T12:00:00.000Z');

function makeRow(overrides: Partial<PendingApproval> = {}): PendingApproval {
  return {
    id: asApprovalTokenId('appr_test_1'),
    runId: 'run_42',
    signalName: 'service.restart',
    role: 'admin',
    issueId: null,
    reason: 'manual override',
    requestedAt: new Date(REF - 60_000).toISOString(),
    timeoutAt: null,
    resolvedAt: null,
    decision: null,
    approver: null,
    ...overrides,
  };
}

describe('adaptApproval', () => {
  it('derives pending status for an unresolved row without a timeout', () => {
    const a = adaptApproval(makeRow(), REF);
    expect(a.status).toBe('pending');
    expect(a.expiredByTimeout).toBe(false);
    expect(a.actionable).toBe(true);
    expect(a.ageSec).toBe(60);
  });

  it('derives expired status when timeoutAt is in the past and decision is null', () => {
    const a = adaptApproval(
      makeRow({ timeoutAt: new Date(REF - 1_000).toISOString() }),
      REF,
    );
    expect(a.status).toBe('expired');
    expect(a.expiredByTimeout).toBe(true);
    expect(a.actionable).toBe(true); // expired-but-not-resolved is still actionable
  });

  it('derives approved status when decision is approve', () => {
    const a = adaptApproval(
      makeRow({ decision: 'approve', approver: 'root', resolvedAt: new Date(REF).toISOString() }),
      REF,
    );
    expect(a.status).toBe('approved');
    expect(a.actionable).toBe(false);
  });

  it('derives denied status when decision is deny', () => {
    const a = adaptApproval(
      makeRow({ decision: 'deny', approver: 'root', resolvedAt: new Date(REF).toISOString() }),
      REF,
    );
    expect(a.status).toBe('denied');
    expect(a.actionable).toBe(false);
  });

  it('derives timeout status when decision is timeout', () => {
    const a = adaptApproval(
      makeRow({ decision: 'timeout', approver: null, resolvedAt: new Date(REF).toISOString() }),
      REF,
    );
    expect(a.status).toBe('timeout');
    expect(a.actionable).toBe(false);
  });

  it('preserves the id, runId, signalName, role, reason, decision, approver', () => {
    const row = makeRow({
      id: asApprovalTokenId('appr_abc'),
      runId: 'run_xyz',
      signalName: 'systemd.restart',
      role: 'ops',
      reason: 'disk pressure',
    });
    const a = adaptApproval(row, REF);
    expect(a.id).toBe('appr_abc');
    expect(a.runId).toBe('run_xyz');
    expect(a.signalName).toBe('systemd.restart');
    expect(a.role).toBe('ops');
    expect(a.reason).toBe('disk pressure');
  });
});

describe('adaptApprovalList', () => {
  it('maps an array of rows to UI approvals', () => {
    const rows = [
      makeRow(),
      makeRow({ id: asApprovalTokenId('appr_2'), decision: 'approve' }),
    ];
    const out = adaptApprovalList(rows, REF);
    expect(out).toHaveLength(2);
    expect(out[0]!.status).toBe('pending');
    expect(out[1]!.status).toBe('approved');
  });

  it('returns an empty array for an empty input', () => {
    expect(adaptApprovalList([], REF)).toEqual([]);
  });
});

describe('filterByStatus', () => {
  const rows: Approval[] = [
    { ...adaptApproval(makeRow(), REF), status: 'pending' },
    { ...adaptApproval(makeRow({ id: asApprovalTokenId('appr_2') }), REF), status: 'expired' },
    { ...adaptApproval(makeRow({ id: asApprovalTokenId('appr_3'), decision: 'approve' }), REF), status: 'approved' },
  ];

  it('keeps all rows when status is all', () => {
    expect(filterByStatus(rows, 'all')).toHaveLength(3);
  });

  it('filters by a single status', () => {
    expect(filterByStatus(rows, 'pending')).toHaveLength(1);
    expect(filterByStatus(rows, 'approved')).toHaveLength(1);
    expect(filterByStatus(rows, 'denied')).toHaveLength(0);
  });
});

describe('filterByAgeBucket', () => {
  const rows: Approval[] = [
    adaptApproval(makeRow({ id: asApprovalTokenId('a') }), REF), // age=60s
    adaptApproval(
      makeRow({
        id: asApprovalTokenId('b'),
        requestedAt: new Date(REF - 5 * 60 * 60 * 1000).toISOString(),
      }),
      REF,
    ), // age=5h
    adaptApproval(
      makeRow({
        id: asApprovalTokenId('c'),
        requestedAt: new Date(REF - 48 * 60 * 60 * 1000).toISOString(),
      }),
      REF,
    ), // age=48h
  ];

  it('keeps all rows when bucket is all', () => {
    expect(filterByAgeBucket(rows, 'all')).toHaveLength(3);
  });

  it('filters by lt1h', () => {
    expect(filterByAgeBucket(rows, 'lt1h')).toHaveLength(1);
  });

  it('filters by lt24h', () => {
    expect(filterByAgeBucket(rows, 'lt24h')).toHaveLength(2);
  });

  it('filters by gt24h', () => {
    expect(filterByAgeBucket(rows, 'gt24h')).toHaveLength(1);
  });
});

describe('filterByQuery', () => {
  const rows: Approval[] = [
    adaptApproval(makeRow({ signalName: 'service.restart' }), REF),
    adaptApproval(
      makeRow({ id: asApprovalTokenId('b'), signalName: 'systemd.restart' }),
      REF,
    ),
    adaptApproval(
      makeRow({
        id: asApprovalTokenId('c'),
        signalName: 'docker.kill',
        reason: 'memory leak',
      }),
      REF,
    ),
  ];

  it('returns all rows when query is empty', () => {
    expect(filterByQuery(rows, '')).toHaveLength(3);
  });

  it('matches against the signal name', () => {
    expect(filterByQuery(rows, 'systemd')).toHaveLength(1);
  });

  it('matches against the reason', () => {
    expect(filterByQuery(rows, 'leak')).toHaveLength(1);
  });

  it('matches case-insensitively', () => {
    expect(filterByQuery(rows, 'DOCKER')).toHaveLength(1);
  });
});

describe('bucketFor', () => {
  it('returns lt1h for under 1h', () => {
    expect(bucketFor(0)).toBe('lt1h');
    expect(bucketFor(60 * 60 - 1)).toBe('lt1h');
  });

  it('returns lt24h for 1h..24h', () => {
    expect(bucketFor(60 * 60)).toBe('lt24h');
    expect(bucketFor(24 * 60 * 60 - 1)).toBe('lt24h');
  });

  it('returns gt24h for >=24h', () => {
    expect(bucketFor(24 * 60 * 60)).toBe('gt24h');
  });
});

describe('formatAge', () => {
  it('formats sub-minute ages in seconds', () => {
    expect(formatAge(0)).toBe('0s');
    expect(formatAge(45)).toBe('45s');
  });

  it('formats sub-hour ages in minutes', () => {
    expect(formatAge(60)).toBe('1m');
    expect(formatAge(5 * 60)).toBe('5m');
  });

  it('formats sub-day ages in hours and minutes', () => {
    expect(formatAge(60 * 60)).toBe('1h');
    expect(formatAge(60 * 60 + 23 * 60)).toBe('1h 23m');
  });

  it('formats multi-day ages in days and hours', () => {
    expect(formatAge(2 * 24 * 60 * 60)).toBe('2d');
    expect(formatAge(2 * 24 * 60 * 60 + 5 * 60 * 60)).toBe('2d 5h');
  });
});

describe('statusToI18nKey', () => {
  it('returns a key for every status', () => {
    expect(statusToI18nKey('pending')).toBe('approvals.status.pending');
    expect(statusToI18nKey('approved')).toBe('approvals.status.approved');
    expect(statusToI18nKey('denied')).toBe('approvals.status.denied');
    expect(statusToI18nKey('expired')).toBe('approvals.status.expired');
    expect(statusToI18nKey('timeout')).toBe('approvals.status.timeout');
    expect(statusToI18nKey('unknown')).toBe('approvals.status.unknown');
  });
});
