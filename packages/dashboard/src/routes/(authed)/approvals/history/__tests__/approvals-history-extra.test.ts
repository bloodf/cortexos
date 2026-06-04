/**
 * approvals-history-extra.test.ts — extra branches for the
 * (authed)/approvals/history/+page.server.ts load().
 *
 * Existing `approvals-history-page.test.ts` covers the happy paths.
 *
 * Untested branches:
 *   - 401 when locals.user is null
 *   - 403 when locals.user is a non-admin
 *   - 403 when locals.user has no cortexos-admin group
 *   - age coercion (invalid bucket → all)
 *   - filters that produce an empty list
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  _resetStubData,
  createPendingApproval,
  resolvePendingApproval,
  revokePendingApproval,
} from '$lib/server/stub-data';
import { load } from '../+page.server';

beforeEach(() => {
  _resetStubData();
});

function makeLoadEvent(url: string, user: object | null) {
  return {
    url: new URL(url, 'http://localhost/'),
    params: {},
    locals: { user, session: null },
  } as unknown as Parameters<typeof load>[0];
}

const adminUser = {
  id: 'u1' as never,
  username: 'root',
  isAdmin: true,
  isActive: true,
  groupMemberships: [{ name: 'cortexos-admin', isAdmin: true }],
};

describe('(authed)/approvals/history — auth + filter branches', () => {
  it('throws 401 when locals.user is null', async () => {
    await expect(
      load(makeLoadEvent('http://localhost/approvals/history', null)),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('throws 403 when locals.user is a non-admin (no cortexos-admin)', async () => {
    const event = makeLoadEvent('http://localhost/approvals/history', {
      id: 'u1' as never,
      username: 'bob',
      isAdmin: false,
      isActive: true,
      groupMemberships: [{ name: 'cortexos-users', isAdmin: false }],
    });
    await expect(load(event)).rejects.toMatchObject({ status: 403 });
  });

  it('coerces an invalid age bucket to all', async () => {
    const r1 = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    resolvePendingApproval(r1.id, 'approve', 'root');
    const data = (await load(
      makeLoadEvent('http://localhost/approvals/history?age=invalid', adminUser),
    )) as unknown as { initialAge: string; total: number; approvals: unknown[] };
    expect(data.initialAge).toBe('all');
    expect(data.total).toBe(1);
    expect(data.approvals).toHaveLength(1);
  });

  it('returns the resolved rows (approved + denied, NOT pending/expired)', async () => {
    const r1 = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const r2 = createPendingApproval({ runId: 'r2', signalName: 'systemd.restart' });
    // r1 stays pending (not in history), r2 approved
    resolvePendingApproval(r2.id, 'approve', 'root');
    const data = (await load(
      makeLoadEvent('http://localhost/approvals/history', adminUser),
    )) as unknown as { total: number; approvals: Array<{ id: string }> };
    expect(data.total).toBe(1);
    expect(data.approvals[0]?.id).toBe(r2.id);
    // r1 should NOT be in history
    expect(data.approvals.find((a) => a.id === r1.id)).toBeUndefined();
  });

  it('honors the ?action= filter', async () => {
    const r1 = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const r2 = createPendingApproval({ runId: 'r2', signalName: 'systemd.restart' });
    resolvePendingApproval(r1.id, 'approve', 'root');
    resolvePendingApproval(r2.id, 'approve', 'root');
    const data = (await load(
      makeLoadEvent('http://localhost/approvals/history?action=service', adminUser),
    )) as unknown as { approvals: Array<{ signalName: string }>; initialAction: string };
    expect(data.initialAction).toBe('service');
    expect(data.approvals).toHaveLength(1);
    expect(data.approvals[0]?.signalName).toBe('service.restart');
  });

  it('accepts cortexos-admin group even when isAdmin is false', async () => {
    const event = makeLoadEvent('http://localhost/approvals/history', {
      id: 'u1' as never,
      username: 'root',
      isAdmin: false,
      isActive: true,
      groupMemberships: [{ name: 'cortexos-admin', isAdmin: true }],
    });
    const data = (await load(event)) as unknown as { total: number };
    expect(data.total).toBe(0);
  });
});
