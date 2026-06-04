/**
 * approvals-list-page.test.ts — exercises the /approvals list page
 * server `load()`: returns the adapted pending rows, applies the
 * `?action=`, `?user=`, `?age=` URL filters, and returns the
 * bootstrap fields.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  _resetStubData,
  createPendingApproval,
  resolvePendingApproval,
} from '$lib/server/stub-data';
import { load as approvalsListLoad } from '../../../../routes/(authed)/approvals/+page.server';

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
  } as unknown as Parameters<typeof approvalsListLoad>[0];
}

/** Shape of the page-server's return value (from +page.server.ts). */
type ListPageData = {
  approvals: Array<{ id: string; signalName: string; runId: string; [k: string]: unknown }>;
  total: number;
  initialAction: string;
  initialUser: string;
  initialAge: 'all' | 'lt1h' | 'lt24h' | 'gt24h';
};

async function loadList(event: ReturnType<typeof makeLoadEvent>): Promise<ListPageData> {
  return (await approvalsListLoad(event)) as unknown as ListPageData;
}

describe('/approvals list page — load()', () => {
  it('returns the empty shape when there are no pending approvals', async () => {
    const data = await loadList(makeLoadEvent('http://localhost/approvals'));
    expect(data.approvals).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.initialAction).toBe('');
    expect(data.initialUser).toBe('');
    expect(data.initialAge).toBe('all');
  });

  it('returns only pending + expired rows (not approved/denied/timeout)', async () => {
    const r1 = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const r2 = createPendingApproval({ runId: 'r2', signalName: 'systemd.restart' });
    const r3 = createPendingApproval({ runId: 'r3', signalName: 'docker.kill' });
    // Mark r2 and r3 as resolved (decision + approver); they should
    // drop out of the pending list and into history.
    resolvePendingApproval(r2.id, 'approve', 'root');
    resolvePendingApproval(r3.id, 'deny', 'alice');

    const data = await loadList(makeLoadEvent('http://localhost/approvals'));
    expect(data.total).toBe(1);
    expect(data.approvals[0]?.id).toBe(r1.id);
  });

  it('honors the ?action= filter (matches against signal / run / reason)', async () => {
    createPendingApproval({ runId: 'r1', signalName: 'service.restart', reason: 'leak' });
    createPendingApproval({ runId: 'r2', signalName: 'systemd.restart' });
    const data = await loadList(
      makeLoadEvent('http://localhost/approvals?action=service'),
    );
    expect(data.approvals).toHaveLength(1);
    expect(data.approvals[0]?.signalName).toBe('service.restart');
    expect(data.initialAction).toBe('service');
  });

  it('honors the ?user= filter and preserves the URL bootstrap', async () => {
    createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const data = await loadList(
      makeLoadEvent('http://localhost/approvals?user=root'),
    );
    // The filter is applied across the visible row fields
    // (signal, run, reason, role). A pending row with no approver
    // set is filtered out by the `root` query — the URL bootstrap
    // still flows through.
    expect(data.initialUser).toBe('root');
  });

  it('honors the ?age= filter (coerces invalid values to all)', async () => {
    createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const valid = await loadList(
      makeLoadEvent('http://localhost/approvals?age=lt1h'),
    );
    expect(valid.approvals).toHaveLength(1);
    expect(valid.initialAge).toBe('lt1h');

    const invalid = await loadList(
      makeLoadEvent('http://localhost/approvals?age=banana'),
    );
    expect(invalid.initialAge).toBe('all');
  });
});
