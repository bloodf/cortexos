/**
 * ApprovalHistoryTimeline.test.ts — verifies the timeline renders
 * the supplied rows with the right status, signal, run, reason,
 * and approver. Also verifies the empty-state rendering.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ApprovalHistoryTimeline from '../ApprovalHistoryTimeline.svelte';
import { adaptApproval, type Approval } from '../adapter';
import type { PendingApproval } from '$lib/server/entities';
import { asApprovalTokenId } from '$lib/server/entities';
import { testMessages } from './messages';

const REF = Date.parse('2026-06-03T12:00:00.000Z');

function makeRow(overrides: Partial<PendingApproval> = {}): PendingApproval {
  return {
    id: asApprovalTokenId('appr_1'),
    runId: 'run_42',
    signalName: 'service.restart',
    role: 'admin',
    issueId: null,
    reason: 'manual override',
    requestedAt: new Date(REF - 5 * 60 * 1000).toISOString(),
    timeoutAt: null,
    resolvedAt: new Date(REF - 60_000).toISOString(),
    decision: 'approve',
    approver: 'root',
    ...overrides,
  };
}

function makeFixture(overrides: Partial<PendingApproval> = {}): Approval {
  return adaptApproval(makeRow(overrides), REF);
}

describe('ApprovalHistoryTimeline', () => {
  afterEach(cleanup);

  it('renders one timeline item per approval row', () => {
    const rows = [
      makeFixture(),
      makeFixture({ id: asApprovalTokenId('appr_2'), decision: 'deny', approver: 'alice' }),
      makeFixture({ id: asApprovalTokenId('appr_3'), decision: 'timeout', approver: null }),
    ];
    const { container } = render(ApprovalHistoryTimeline, {
      props: { approvals: rows, messages: testMessages },
    });
    const items = container.querySelectorAll('[data-slot="approval-history-item"]');
    expect(items).toHaveLength(3);
  });

  it('renders the signal name and run id on each item', () => {
    const row = makeFixture();
    const { container } = render(ApprovalHistoryTimeline, {
      props: { approvals: [row], messages: testMessages },
    });
    const signal = container.querySelector('[data-slot="approval-history-signal"]');
    const run = container.querySelector('[data-slot="approval-history-run"]');
    expect(signal?.textContent?.trim()).toBe('service.restart');
    expect(run?.textContent?.trim()).toContain('run_42');
  });

  it('renders the approver', () => {
    const row = makeFixture();
    const { container } = render(ApprovalHistoryTimeline, {
      props: { approvals: [row], messages: testMessages },
    });
    const approver = container.querySelector('[data-slot="approval-history-approver"]');
    expect(approver?.textContent).toContain('root');
  });

  it('renders the empty state when there are no rows', () => {
    const { container } = render(ApprovalHistoryTimeline, {
      props: { approvals: [], messages: testMessages },
    });
    const empty = container.querySelector('[data-slot="approval-history-empty"]');
    expect(empty).not.toBeNull();
  });
});
