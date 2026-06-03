/**
 * ApprovalActionBar.test.ts — verifies the action bar renders
 * grant + revoke forms, points at the correct endpoints, and
 * disables buttons when the approval is no longer actionable.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ApprovalActionBar from '../ApprovalActionBar.svelte';
import { adaptApproval, type Approval } from '../adapter';
import type { PendingApproval } from '$lib/server/entities';
import { asApprovalTokenId } from '$lib/server/entities';
import { testMessages } from './messages';

const REF = Date.parse('2026-06-03T12:00:00.000Z');

function makeRow(overrides: Partial<PendingApproval> = {}): PendingApproval {
  return {
    id: asApprovalTokenId('appr_abc'),
    runId: 'run_42',
    signalName: 'service.restart',
    role: 'admin',
    issueId: null,
    reason: null,
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

describe('ApprovalActionBar', () => {
  afterEach(cleanup);

  it('renders both grant and revoke forms', () => {
    const { container } = render(ApprovalActionBar, {
      props: { approval: makeFixture(), messages: testMessages },
    });
    const grant = container.querySelector('[data-slot="approval-grant-form"]');
    const revoke = container.querySelector('[data-slot="approval-revoke-form"]');
    expect(grant).not.toBeNull();
    expect(revoke).not.toBeNull();
  });

  it('points the grant form at /api/approvals/[id]/grant', () => {
    const { container } = render(ApprovalActionBar, {
      props: { approval: makeFixture(), messages: testMessages },
    });
    const grant = container.querySelector(
      '[data-slot="approval-grant-form"]',
    ) as HTMLFormElement | null;
    expect(grant?.getAttribute('action')).toBe('/api/approvals/appr_abc/grant');
    expect(grant?.getAttribute('method')?.toUpperCase()).toBe('POST');
  });

  it('points the revoke form at /api/approvals/[id]/revoke', () => {
    const { container } = render(ApprovalActionBar, {
      props: { approval: makeFixture(), messages: testMessages },
    });
    const revoke = container.querySelector(
      '[data-slot="approval-revoke-form"]',
    ) as HTMLFormElement | null;
    expect(revoke?.getAttribute('action')).toBe('/api/approvals/appr_abc/revoke');
  });

  it('enables the buttons when the approval is actionable', () => {
    const { container } = render(ApprovalActionBar, {
      props: { approval: makeFixture(), messages: testMessages },
    });
    const grant = container.querySelector(
      '[data-slot="approval-grant-button"] button',
    ) as HTMLButtonElement | null;
    const revoke = container.querySelector(
      '[data-slot="approval-revoke-button"] button',
    ) as HTMLButtonElement | null;
    expect(grant?.disabled).toBe(false);
    expect(revoke?.disabled).toBe(false);
  });

  it('disables both buttons when the approval is already approved', () => {
    const approved = makeFixture({ decision: 'approve', approver: 'root' });
    const { container } = render(ApprovalActionBar, {
      props: { approval: approved, messages: testMessages },
    });
    const grant = container.querySelector(
      '[data-slot="approval-grant-button"] button',
    ) as HTMLButtonElement | null;
    const revoke = container.querySelector(
      '[data-slot="approval-revoke-button"] button',
    ) as HTMLButtonElement | null;
    expect(grant?.disabled).toBe(true);
    expect(revoke?.disabled).toBe(true);
  });

  it('disables both buttons when busy is true', () => {
    const { container } = render(ApprovalActionBar, {
      props: { approval: makeFixture(), messages: testMessages, busy: true },
    });
    const grant = container.querySelector(
      '[data-slot="approval-grant-button"] button',
    ) as HTMLButtonElement | null;
    const revoke = container.querySelector(
      '[data-slot="approval-revoke-button"] button',
    ) as HTMLButtonElement | null;
    expect(grant?.disabled).toBe(true);
    expect(revoke?.disabled).toBe(true);
  });
});
