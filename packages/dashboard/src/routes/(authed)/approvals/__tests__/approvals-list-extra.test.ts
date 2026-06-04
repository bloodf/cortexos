/**
 * approvals-list-page-extra.test.ts — extra branches for the
 * (authed)/approvals/+page.server.ts load().
 *
 * Existing `approvals-list-page.test.ts` covers:
 *   - empty list, pending-vs-resolved filtering, ?action= / ?user=
 *     / ?age= URL filters, all-ages, lt1h, lt24h, gt24h.
 *
 * Untested branches:
 *   - 401 when locals.user is null
 *   - 403 when locals.user is not admin (no cortexos-admin group)
 *   - Default age= coercion (an invalid bucket falls back to 'all')
 *   - Both initial fields are returned even when both filters are set
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetStubData, createPendingApproval } from '$lib/server/stub-data';
import { load } from '../../../../routes/(authed)/approvals/+page.server';

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
        groupMemberships: [{ name: 'cortexos-admin', isAdmin: true }],
      },
      session: null,
    },
  } as unknown as Parameters<typeof load>[0];
}

describe('(authed)/approvals — auth gate branches', () => {
  it('throws 401 when locals.user is null', async () => {
    const event = {
      url: new URL('http://localhost/approvals'),
      params: {},
      locals: { user: null, session: null },
    } as unknown as Parameters<typeof load>[0];
    await expect(load(event)).rejects.toMatchObject({ status: 401 });
  });

  it('throws 403 when locals.user is a non-admin (no cortexos-admin group)', async () => {
    const event = {
      url: new URL('http://localhost/approvals'),
      params: {},
      locals: {
        user: {
          id: 'u1' as never,
          username: 'bob',
          isAdmin: false,
          isActive: true,
          groupMemberships: [{ name: 'cortexos-users', isAdmin: false }],
        },
        session: null,
      },
    } as unknown as Parameters<typeof load>[0];
    await expect(load(event)).rejects.toMatchObject({ status: 403 });
  });

  it('coerces an invalid age bucket to all', async () => {
    createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const data = await load(
      makeLoadEvent('http://localhost/approvals?age=invalid-bucket'),
    ) as unknown as { initialAge: string };
    expect(data.initialAge).toBe('all');
  });

  it('returns initialAction + initialUser when both filters are set', async () => {
    createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const data = await load(
      makeLoadEvent('http://localhost/approvals?action=service&user=root'),
    ) as unknown as { initialAction: string; initialUser: string; initialAge: string };
    expect(data.initialAction).toBe('service');
    expect(data.initialUser).toBe('root');
    expect(data.initialAge).toBe('all');
  });

  it('accepts the cortexos-admin group even when isAdmin is false', async () => {
    const event = {
      url: new URL('http://localhost/approvals'),
      params: {},
      locals: {
        user: {
          id: 'u1' as never,
          username: 'root',
          isAdmin: false,
          isActive: true,
          groupMemberships: [{ name: 'cortexos-admin', isAdmin: true }],
        },
        session: null,
      },
    } as unknown as Parameters<typeof load>[0];
    const data = await load(event) as unknown as { approvals: unknown[] };
    expect(data.approvals).toEqual([]);
  });
});
