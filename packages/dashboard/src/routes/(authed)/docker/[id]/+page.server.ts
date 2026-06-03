/**
 * /docker/[id] — single-container detail page server load + actions.
 *
 * The URL parameter is the container's id (sha256:hex or short hex).
 * We also accept the container's `name` (legacy links) by routing
 * through `getContainerByName` if the id lookup fails.
 *
 * Actions (PB-5: every destructive op requires an approval token,
 * minted via the approval module's `mintApproval` on the page render):
 *   - `start`   → `startContainer(id)` (admin-only)
 *   - `stop`    → `stopContainer(id)`  (admin-only, approval)
 *   - `restart` → `restartContainer(id)` (admin-only, approval)
 *   - `remove`  → `removeContainer(id)`  (admin-only, approval)
 *
 * The form action receives a `approvalToken` field (hidden input
 * written by the page). The server verifies the token against the
 * action hash; mismatched/expired/already-used tokens are rejected.
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
} from '$lib/server/docker/stub-data';
import { adaptContainer } from '$lib/components/docker/adapter';
import { actionHashFor, mintApproval, consumeApproval, verifyApproval } from '$lib/server/approval';
import { requireAdmin } from '$lib/server/auth';

function loadContainer(id: string) {
  if (!id) return null;
  return getContainerById(id) ?? getContainerByName(id);
}

function methodNotAllowed(): Response {
  return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, POST' } });
}

export const load: PageServerLoad = async ({ params, locals }) => {
  const id = params.id;
  if (!id) throw error(400, 'Missing container identifier');

  const c = loadContainer(id);
  if (!c) throw error(404, `Container '${id}' not found`);

  // PB-5: mint an approval token for every destructive op so the
  // client can reuse the same token for one user action. Each
  // action gets its own token (different action-hash).
  // Require an authenticated admin to mint — the (authed) layout
  // already gates the page, but the layout uses locals.user; for
  // the route load we read locals.user directly.
  // The contracts `User` and `Session` shapes diverge from the
  // local `User` / `Session` branded types; the cast below is
  // safe because we only read `isAdmin`, `id`, and the session id
  // (all present on the contracts shape).
  const user = locals.user as unknown as { id: string; isAdmin: boolean; groupMemberships?: string[] } | null;
  const session = locals.session as unknown as { id: string } | null;
  const isAdmin = Boolean(
    user && (user.isAdmin || (user.groupMemberships?.includes('cortexos-admin') ?? false)),
  );

  let tokens: { start?: string; stop?: string; restart?: string; remove?: string } = {};
  if (isAdmin && user && session) {
    const cid = c.id as unknown as string;
    // The bridge recomputes the action-hash as
    // `actionHashFor(op, { op, args })`. The token must be minted
    // with the SAME (action, payload) tuple.
    // The local `mintApproval` expects branded `SessionId` /
    // `UserId`; cast the string at the boundary.
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
  // Map the form action name to the policy op name. The policy
  // allowlist uses `rm`; the form action is `remove` (UI clarity).
  const policyOp = op === 'remove' ? 'docker.rm' : `docker.${op}`;
  const expected = actionHashFor(policyOp, { op: policyOp, args: { container: id } });
  const verified = verifyApproval(token, sessionId as never);
  if (!verified.ok) {
    return { ok: false, reason: `Approval token rejected: ${verified.reason}.` };
  }
  if (verified.claims.actionHash !== expected) {
    return { ok: false, reason: 'Approval token action-hash mismatch (PB-5).' };
  }
  // Consume the token so it cannot be replayed.
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
    const c = loadContainer(id);
    if (!c) return fail(404, { error: `Container '${id}' not found` });
    try {
      const updated = startContainer(c.id as unknown as string);
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
    const c = loadContainer(id);
    if (!c) return fail(404, { error: `Container '${id}' not found` });
    try {
      const updated = stopContainer(c.id as unknown as string);
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
    const c = loadContainer(id);
    if (!c) return fail(404, { error: `Container '${id}' not found` });
    try {
      const updated = restartContainer(c.id as unknown as string);
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
    const c = loadContainer(id);
    if (!c) return fail(404, { error: `Container '${id}' not found` });
    try {
      const ok = removeContainer(c.id as unknown as string);
      if (!ok) return fail(404, { error: `Container '${id}' not found` });
      // After remove, redirect back to the list. The form action
      // runs server-side so the redirect is honoured by use:enhance
      // and full-page POSTs alike.
      throw redirect(303, '/docker');
    } catch (e) {
      // Re-throw SvelteKit's `redirect` so the framework handles it.
      if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
        throw e;
      }
      return fail(500, { error: (e as Error).message });
    }
  },
  // Alias: `rm` is the form action that maps to the policy op
  // `docker.rm`. Both call the same business logic.
  rm: async (event) => actions.remove!(event),
};

// Default fallback for non-action HTTP methods on this route.
// `+page.server.ts` is the page-server; HTTP handlers live in
// `+server.ts` files. The form actions above (`start`, `stop`,
// `restart`, `remove`, `rm`) are dispatched via the form-action
// protocol — there's no plain GET/POST handler here.
// Reference the helper to keep TS strict about the import.
export const _methodNotAllowed = methodNotAllowed;
