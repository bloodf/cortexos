/**
 * /docker/[id] — single-container detail page server load + actions.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  getContainerById,
  getContainerByName,
  startContainer,
  stopContainer,
  restartContainer,
  removeContainer,
} from '$lib/server/docker/real-data';
import { adaptContainer } from '$lib/components/docker/adapter';
import { actionHashFor, mintApproval, consumeApproval, verifyApproval } from '$lib/server/approval';
import { requireAdmin } from '$lib/server/auth';

async function loadContainer(id: string) {
  if (!id) return null;
  return (await getContainerById(id)) ?? (await getContainerByName(id));
}

function methodNotAllowed(): Response {
  return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, POST' } });
}

export const load: PageServerLoad = async ({ params, locals }) => {
  const id = params.id;
  if (!id) throw error(400, 'Missing container identifier');

  const c = await loadContainer(id);
  if (!c) throw error(404, `Container '${id}' not found`);

  const user = locals.user as unknown as { id: string; isAdmin: boolean; groupMemberships?: string[] } | null;
  const session = locals.session as unknown as { id: string } | null;
  const isAdmin = Boolean(
    user && (user.isAdmin || (user.groupMemberships?.includes('cortexos-admin') ?? false)),
  );

  let tokens: { start?: string; stop?: string; restart?: string; remove?: string } = {};
  if (isAdmin && user && session) {
    const cid = c.id as unknown as string;
    const sid = session.id as never;
    const uid = user.id as never;
    tokens = {
      start: mintApproval({
        action: 'docker.start',
        payload: { op: 'docker.start', args: { container: cid } },
        sessionId: sid,
        userId: uid,
        ttlSec: 60,
      }).token,
      stop: mintApproval({
        action: 'docker.stop',
        payload: { op: 'docker.stop', args: { container: cid } },
        sessionId: sid,
        userId: uid,
        ttlSec: 60,
      }).token,
      restart: mintApproval({
        action: 'docker.restart',
        payload: { op: 'docker.restart', args: { container: cid } },
        sessionId: sid,
        userId: uid,
        ttlSec: 60,
      }).token,
      remove: mintApproval({
        action: 'docker.rm',
        payload: { op: 'docker.rm', args: { container: cid } },
        sessionId: sid,
        userId: uid,
        ttlSec: 60,
      }).token,
    };
  }

  return {
    container: adaptContainer({
      id: c.id as unknown as string,
      name: c.name,
      image: c.image,
      state: c.state,
      status: c.status,
      ports: c.ports,
      created: c.created,
      privileged: c.privileged,
      networks: c.networks,
      mounts: c.mounts,
    }),
    approvalTokens: tokens,
    isAdmin,
  };
};

/** Verify the approval token bound to this op. */
function checkApproval(
  op: 'start' | 'stop' | 'restart' | 'remove',
  id: string,
  token: string | null,
  sessionId: string,
): { ok: true } | { ok: false; reason: string } {
  if (!token) {
    return { ok: false, reason: 'Missing approval token (PB-5).' };
  }
  const policyOp = op === 'remove' ? 'docker.rm' : `docker.${op}`;
  const expected = actionHashFor(policyOp, { op: policyOp, args: { container: id } });
  const verified = verifyApproval(token, sessionId as never);
  if (!verified.ok) {
    return { ok: false, reason: `Approval token rejected: ${verified.reason}.` };
  }
  if (verified.claims.actionHash !== expected) {
    return { ok: false, reason: 'Approval token action-hash mismatch (PB-5).' };
  }
  const consumed = consumeApproval(token, sessionId as never);
  if (!consumed.ok) {
    return { ok: false, reason: `Approval token consume failed: ${consumed.reason}.` };
  }
  return { ok: true };
}

export const actions: Actions = {
  start: async ({ params, request, locals }) => {
    requireAdmin({ locals } as never);
    const id = params.id;
    if (!id) return fail(400, { error: 'Missing container identifier' });
    const fd = await request.formData();
    const token = (fd.get('approvalToken') as string | null) ?? null;
    const sessionId = locals.session?.id;
    if (!sessionId) return fail(401, { error: 'Authentication required' });
    const verdict = checkApproval('start', id, token, sessionId);
    if (!verdict.ok) return fail(403, { error: verdict.reason });
    const c = await loadContainer(id);
    if (!c) return fail(404, { error: `Container '${id}' not found` });
    try {
      const updated = await startContainer(c.id as unknown as string);
      return { ok: true, action: 'start' as const, state: updated.state };
    } catch (e) {
      return fail(500, { error: (e as Error).message });
    }
  },

  stop: async ({ params, request, locals }) => {
    requireAdmin({ locals } as never);
    const id = params.id;
    if (!id) return fail(400, { error: 'Missing container identifier' });
    const fd = await request.formData();
    const token = (fd.get('approvalToken') as string | null) ?? null;
    const sessionId = locals.session?.id;
    if (!sessionId) return fail(401, { error: 'Authentication required' });
    const verdict = checkApproval('stop', id, token, sessionId);
    if (!verdict.ok) return fail(403, { error: verdict.reason });
    const c = await loadContainer(id);
    if (!c) return fail(404, { error: `Container '${id}' not found` });
    try {
      const updated = await stopContainer(c.id as unknown as string);
      return { ok: true, action: 'stop' as const, state: updated.state };
    } catch (e) {
      return fail(500, { error: (e as Error).message });
    }
  },

  restart: async ({ params, request, locals }) => {
    requireAdmin({ locals } as never);
    const id = params.id;
    if (!id) return fail(400, { error: 'Missing container identifier' });
    const fd = await request.formData();
    const token = (fd.get('approvalToken') as string | null) ?? null;
    const sessionId = locals.session?.id;
    if (!sessionId) return fail(401, { error: 'Authentication required' });
    const verdict = checkApproval('restart', id, token, sessionId);
    if (!verdict.ok) return fail(403, { error: verdict.reason });
    const c = await loadContainer(id);
    if (!c) return fail(404, { error: `Container '${id}' not found` });
    try {
      const updated = await restartContainer(c.id as unknown as string);
      return { ok: true, action: 'restart' as const, state: updated.state };
    } catch (e) {
      return fail(500, { error: (e as Error).message });
    }
  },

  remove: async ({ params, request, locals }) => {
    requireAdmin({ locals } as never);
    const id = params.id;
    if (!id) return fail(400, { error: 'Missing container identifier' });
    const fd = await request.formData();
    const token = (fd.get('approvalToken') as string | null) ?? null;
    const sessionId = locals.session?.id;
    if (!sessionId) return fail(401, { error: 'Authentication required' });
    const verdict = checkApproval('remove', id, token, sessionId);
    if (!verdict.ok) return fail(403, { error: verdict.reason });
    const c = await loadContainer(id);
    if (!c) return fail(404, { error: `Container '${id}' not found` });
    try {
      await removeContainer(c.id as unknown as string);
      throw redirect(303, '/docker');
    } catch (e) {
      if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
        throw e;
      }
      return fail(500, { error: (e as Error).message });
    }
  },
  rm: async (event) => actions.remove!(event),
};

export const _methodNotAllowed = methodNotAllowed;
