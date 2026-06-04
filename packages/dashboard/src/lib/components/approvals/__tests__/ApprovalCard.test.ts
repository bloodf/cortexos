/**
 * ApprovalCard.test.ts — verifies the card renders the approval
 * record's signal name, run id, status badge, and age.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ApprovalCard from '../ApprovalCard.svelte';
import { adaptApproval, type Approval } from '../adapter';
import type { PendingApproval } from '$lib/server/entities';
import { asApprovalTokenId } from '$lib/server/entities';
import { testMessages } from './messages';

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

function makeFixture(overrides: Partial<PendingApproval> = {}): Approval {
  return adaptApproval(makeRow(overrides), REF);
}

const fixture = makeFixture();

describe('ApprovalCard', () => {
  afterEach(cleanup);

  it('renders the signal name and run id', () => {
    const { container } = render(ApprovalCard, {
      props: { approval: fixture, messages: testMessages },
    });
    const signal = container.querySelector('[data-slot="approval-signal"]');
    expect(signal?.textContent?.trim()).toBe('service.restart');
    const run = container.querySelector('[data-slot="approval-run"]');
    expect(run?.textContent?.trim()).toBe('run_42');
  });

  it('renders the reason when present', () => {
    const { container } = render(ApprovalCard, {
      props: { approval: fixture, messages: testMessages },
    });
    const reason = container.querySelector('[data-slot="approval-reason"]');
    expect(reason?.textContent?.trim()).toBe('manual override');
  });

  it('renders an em-dash when the reason is missing', () => {
    const noReason = makeFixture({ reason: null });
    const { container } = render(ApprovalCard, {
      props: { approval: noReason, messages: testMessages },
    });
    const empty = container.querySelector('[data-slot="approval-reason-empty"]');
    expect(empty?.textContent?.trim()).toBe('—');
  });

  it('formats the age as 1m (60 seconds)', () => {
    const { container } = render(ApprovalCard, {
      props: { approval: fixture, messages: testMessages },
    });
    const age = container.querySelector('[data-slot="approval-age"]');
    expect(age?.textContent?.trim()).toBe('1m');
  });

  it('invokes onSelect when the card is clicked', () => {
    const calls: Approval[] = [];
    const { container } = render(ApprovalCard, {
      props: {
        approval: fixture,
        messages: testMessages,
        onSelect: (a: Approval) => {
          calls.push(a);
        },
      },
    });
    const interactive = container.querySelector(
      '[data-slot="approval-card"]',
    ) as HTMLElement | null;
    interactive?.click();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.id).toBe('appr_test_1');
  });

  it('does not render as a button when onSelect is omitted', () => {
    const { container } = render(ApprovalCard, {
      props: { approval: fixture, messages: testMessages },
    });
    const card = container.querySelector('[data-slot="approval-card"]');
    expect(card?.getAttribute('role')).toBeNull();
    expect(card?.getAttribute('tabindex')).toBeNull();
  });
});
