/**
 * approvals-detail-page.test.ts — exercises the /approvals/[id]
 * detail page server `load()`: returns the adapted approval for
 * the requested id, and throws 404 for an unknown id.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { _resetStubData, createPendingApproval } from '$lib/server/stub-data';
import { load as approvalsDetailLoad } from '../+page.server';

beforeEach(() => {
  _resetStubData();
});

function makeLoadEvent(id: string | undefined) {
  return {
    params: { id: id ?? '' },
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
  } as unknown as Parameters<typeof approvalsDetailLoad>[0];
}

describe('/approvals/[id] detail page — load()', () => {
  it('returns the adapted approval for a known id', async () => {
    const row = createPendingApproval({ runId: 'r1', signalName: 'service.restart' });
    const data = (await approvalsDetailLoad(makeLoadEvent(row.id))) as unknown as {
      approval: { id: string; signalName: string; runId: string };
    };
    expect(data.approval.id).toBe(row.id);
    expect(data.approval.signalName).toBe('service.restart');
    expect(data.approval.runId).toBe('r1');
  });

  it('throws 404 for an unknown id', async () => {
    let caught: unknown = null;
    try {
      await approvalsDetailLoad(makeLoadEvent('appr_does_not_exist'));
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    if (isHttpError(caught)) {
      expect(caught.status).toBe(404);
    } else {
      // SvelteKit's `error()` throws an HttpError; some test harnesses
      // surface it as a plain Error with a `status` field instead.
      const err = caught as { status?: number };
      expect(err.status).toBe(404);
    }
  });

  it('throws 400 when the id is missing', async () => {
    let caught: unknown = null;
    try {
      await approvalsDetailLoad(makeLoadEvent(undefined));
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    if (isHttpError(caught)) {
      expect(caught.status).toBe(400);
    } else {
      const err = caught as { status?: number };
      expect(err.status).toBe(400);
    }
  });
});
