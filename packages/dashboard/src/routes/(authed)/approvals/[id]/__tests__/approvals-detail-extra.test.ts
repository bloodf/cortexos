/**
 * approvals-detail-page-extra.test.ts — extra branches for the
 * (authed)/approvals/[id]/+page.server.ts load().
 *
 * Existing `approvals-detail-page.test.ts` covers the happy path.
 *
 * Untested branches:
 *   - 401 when locals.user is null
 *   - 403 when locals.user is not admin
 *   - 400 when params.id is missing
 *   - 404 when the row is unknown
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetStubData, createPendingApproval } from '$lib/server/stub-data';
import { load } from '../+page.server';

beforeEach(() => {
  _resetStubData();
});

function makeLoadEvent(id: string | undefined, user: object | null) {
  return {
    url: new URL(`http://localhost/approvals/${id ?? ''}`),
    params: { id: id ?? '' },
    locals: { user, session: null },
  } as unknown as Parameters<typeof load>[0];
}

const adminUser = {
  id: 'u1' as never,
  username: 'root',
  isAdmin: true,
  isActive: true,
  groupMemberships: ['cortexos-admin' as const],
};

describe('(authed)/approvals/[id] — auth + id branches', () => {
  it('throws 401 when locals.user is null', async () => {
    await expect(load(makeLoadEvent('appr_1', null))).rejects.toMatchObject({ status: 401 });
  });

  it('throws 403 when locals.user is a non-admin', async () => {
    const event = makeLoadEvent('appr_1', {
      id: 'u1' as never,
      username: 'bob',
      isAdmin: false,
      isActive: true,
      groupMemberships: ['cortexos-users' as const],
    });
    await expect(load(event)).rejects.toMatchObject({ status: 403 });
  });

  it('throws 400 when params.id is missing', async () => {
    await expect(load(makeLoadEvent('', adminUser))).rejects.toMatchObject({ status: 400 });
  });

  it('throws 404 for an unknown approval id', async () => {
    await expect(load(makeLoadEvent('appr_does_not_exist', adminUser))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('returns the adapted row for a known id (admin)', async () => {
    const row = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const data = await load(makeLoadEvent(row.id, adminUser)) as unknown as {
      approval: { id: string };
    };
    expect(data.approval.id).toBe(row.id);
  });
});
