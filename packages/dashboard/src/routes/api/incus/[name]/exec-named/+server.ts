/**
 * /api/incus/[name]/exec-named — PB-4 FIX.
 *
 * Replaces the old `/api/incus/[name]/shell` arbitrary-exec endpoint
 * (THREAT_MODEL §1.2 surface 6, T-051, PB-4) with a named-op allowlist.
 *
 *   - admin-only (`requireAdmin`)
 *   - approval-token required (PB-5)
 *   - Same closed set of `term.*` + `incus.exec-named` ops as
 *     `/api/terminal` (THREAT_MODEL §4.4.4).
 *   - No `bash -c <userstring>` from UI (SR-019 belt-and-braces at
 *     both the route and the bridge).
 *
 * The route delegates the policy + arg-smuggling checks to
 * `dispatchExecNamed` in `$lib/server/incus/bridge.ts`, which is
 * the same seam the docker + terminal bridges use.
 */
import { z } from 'zod';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentSession, isAdmin } from '$lib/server/auth';
import { dispatchExecNamed } from '$lib/server/incus/bridge';
import { IncusShellOpSchema } from '@cortexos/contracts';

const ExecInput = z.object({
  op: IncusShellOpSchema,
  args: z.record(z.string(), z.unknown()).default({}),
});

export const POST: RequestHandler = async (event) => {
  const name = event.params.name;
  if (!name) return json({ message: 'Missing instance name' }, { status: 400 });

  // 1. Auth (admin only).
  const resolved = await getCurrentSession(event);
  if (!resolved) return json({ message: 'Authentication required' }, { status: 401 });
  if (!isAdmin(resolved.user))
    return json({ message: 'Admin role required' }, { status: 403 });

  // 2. Input validation.
  let body: unknown;
  try {
    body = await event.request.json();
  } catch {
    return json({ message: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = ExecInput.safeParse(body);
  if (!parsed.success) {
    return json(
      { message: 'Invalid input shape', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // 3. Dispatch through the bridge. The bridge re-runs the
  //    arg-smuggling scan + the literal `bash -c` check (SR-019).
  const result = await dispatchExecNamed(
    name,
    { op: parsed.data.op, args: parsed.data.args },
    {
      user: resolved.user,
      ip: event.getClientAddress(),
      userAgent: event.request.headers.get('user-agent'),
      requestId: (event.locals as { requestId?: string }).requestId ?? '',
    },
  );

  if (result.status === 'accepted') {
    return json({
      status: 'accepted' as const,
      op: result.op,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });
  }
  // Rejected — map to 400.
  return json(
    {
      status: 'rejected' as const,
      op: result.op,
      code: result.code,
      reason: result.reason,
      ...(result.field ? { field: result.field } : {}),
    },
    { status: 400 },
  );
};

export const GET: RequestHandler = () =>
  new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
export const PUT: RequestHandler = () =>
  new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
export const PATCH: RequestHandler = () =>
  new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
export const DELETE: RequestHandler = () =>
  new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
