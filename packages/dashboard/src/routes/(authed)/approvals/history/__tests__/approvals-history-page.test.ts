/**
 * approvals-history-page.test.ts — exercises the
 * /approvals/history page server `load()`: returns only the
 * resolved (approved/denied/timeout) approvals, sorted
 * newest-first, and honors the URL filter bootstrap.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  _resetStubData,
  createPendingApproval,
  resolvePendingApproval,
} from '$lib/server/stub-data';
import { load as approvalsHistoryLoad } from '../+page.server';

beforeEach(() => {
  _resetStubData();
});

function makeLoadEvent(url: string, params: Record<string, string> = {}) {
  const u = new URL(url, 'http://localhost/');
  return {
    url: u,
    params,
    locals: {
      user: {
        id: 'u1' as never,
        username: 'root',
        isAdmin: true,
        isActive: true,
        groupMemberships: ['cortexos-admin' as const],
      },
      session: null,
    },
  } as unknown as Parameters<typeof approvalsHistoryLoad>[0];
}

type HistoryPageData = {
  approvals: Array<{ id: string; status: string; [k: string]: unknown }>;
  total: number;
  initialAction: string;
  initialUser: string;
  initialAge: 'all' | 'lt1h' | 'lt24h' | 'gt24h';
};

async function loadHistory(event: ReturnType<typeof makeLoadEvent>): Promise<HistoryPageData> {
  return (await approvalsHistoryLoad(event)) as unknown as HistoryPageData;
}

describe('/approvals/history page — load()', () => {
  it('returns the empty shape when there are no resolved approvals', async () => {
    createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const data = await loadHistory(makeLoadEvent('http://localhost/approvals/history'));
    expect(data.approvals).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.initialAction).toBe('');
    expect(data.initialUser).toBe('');
    expect(data.initialAge).toBe('all');
  });

  it('returns only approved / denied / timeout rows (not pending)', async () => {
    const a = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const b = createPendingApproval({ runId: 'r2', signalName: 'systemd.restart' });
    const c = createPendingApproval({ runId: 'r3', signalName: 'docker.kill' });
    const d = createPendingApproval({ runId: 'r4', signalName: 'incus.reboot' });
    resolvePendingApproval(a.id, 'approve', 'root');
    resolvePendingApproval(b.id, 'deny', 'alice');
    resolvePendingApproval(c.id, 'timeout', 'system');
    // d is still pending — should not appear in history.

    const data = await loadHistory(makeLoadEvent('http://localhost/approvals/history'));
    expect(data.total).toBe(3);
    expect(data.approvals.find((r) => r.id === d.id)).toBeUndefined();
  });

  it('honors the ?action= filter', async () => {
    const a = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const b = createPendingApproval({ runId: 'r2', signalName: 'systemd.restart' });
    resolvePendingApproval(a.id, 'approve', 'root');
    resolvePendingApproval(b.id, 'approve', 'root');

    const data = await loadHistory(
      makeLoadEvent('http://localhost/approvals/history?action=service'),
    );
    expect(data.approvals).toHaveLength(1);
    expect(data.approvals[0]?.id).toBe(a.id);
    expect(data.initialAction).toBe('service');
  });

  it('coerces invalid ?age= to all', async () => {
    const a = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    resolvePendingApproval(a.id, 'approve', 'root');
    const data = await loadHistory(
      makeLoadEvent('http://localhost/approvals/history?age=banana'),
    );
    expect(data.initialAge).toBe('all');
  });
});
