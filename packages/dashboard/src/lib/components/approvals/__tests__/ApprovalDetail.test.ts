/**
 * ApprovalDetail.test.ts — verifies the detail view renders the
 * approval's signal, run, role, reason, status, and timestamps.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ApprovalDetail from '../ApprovalDetail.svelte';
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
    issueId: 'iss_1',
    reason: 'manual override',
    requestedAt: new Date(REF - 60_000).toISOString(),
    timeoutAt: new Date(REF + 60_000).toISOString(),
    resolvedAt: null,
    decision: null,
    approver: null,
    ...overrides,
  };
}

function makeFixture(overrides: Partial<PendingApproval> = {}): Approval {
  return adaptApproval(makeRow(overrides), REF);
}

describe('ApprovalDetail', () => {
  afterEach(cleanup);

  it('renders the signal name in the title slot', () => {
    const { container } = render(ApprovalDetail, {
      props: { approval: makeFixture(), messages: testMessages },
    });
    const signal = container.querySelector('[data-slot="approval-detail-signal"]');
    expect(signal?.textContent?.trim()).toBe('service.restart');
  });

  it('renders the run id', () => {
    const { container } = render(ApprovalDetail, {
      props: { approval: makeFixture(), messages: testMessages },
    });
    const run = container.querySelector('[data-slot="approval-detail-run"]');
    expect(run?.textContent?.trim()).toContain('run_42');
  });

  it('renders the role and issue id', () => {
    const { container } = render(ApprovalDetail, {
      props: { approval: makeFixture(), messages: testMessages },
    });
    const role = container.querySelector('[data-slot="approval-detail-role"]');
    const issue = container.querySelector('[data-slot="approval-detail-issue"]');
    expect(role?.textContent?.trim()).toBe('admin');
    expect(issue?.textContent?.trim()).toBe('iss_1');
  });

  it('renders em-dash for missing role and issue', () => {
    const noRole = makeFixture({ role: null, issueId: null });
    const { container } = render(ApprovalDetail, {
      props: { approval: noRole, messages: testMessages },
    });
    const role = container.querySelector('[data-slot="approval-detail-role"]');
    const issue = container.querySelector('[data-slot="approval-detail-issue"]');
    expect(role?.textContent?.trim()).toBe('—');
    expect(issue?.textContent?.trim()).toBe('—');
  });

  it('renders the requested/timeout/resolved timestamps', () => {
    const { container } = render(ApprovalDetail, {
      props: { approval: makeFixture(), messages: testMessages },
    });
    const requested = container.querySelector('[data-slot="approval-detail-requested-at"]');
    const timeout = container.querySelector('[data-slot="approval-detail-timeout-at"]');
    const resolved = container.querySelector('[data-slot="approval-detail-resolved-at"]');
    expect(requested?.textContent).toContain('1m');
    expect(timeout?.textContent).toContain('UTC');
    expect(resolved?.textContent?.trim()).toBe('—');
  });

  it('renders the action snippet when provided', () => {
    const { container } = render(ApprovalDetail, {
      props: {
        approval: makeFixture(),
        messages: testMessages,
        actions: () => {},
      },
    });
    const actions = container.querySelector('[data-slot="approval-detail-actions"]');
    expect(actions).not.toBeNull();
  });

  it('does not render the action wrapper when no actions snippet', () => {
    const { container } = render(ApprovalDetail, {
      props: { approval: makeFixture(), messages: testMessages },
    });
    const actions = container.querySelector('[data-slot="approval-detail-actions"]');
    expect(actions).toBeNull();
  });
});
