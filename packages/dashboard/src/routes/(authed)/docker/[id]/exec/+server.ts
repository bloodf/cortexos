/**
 * /docker/[id]/exec — POST an allowlisted subcommand inside a
 * container. PB-5: admin-only + requires a valid approval token.
 * PB-2 / SR-019: `bash -c <userstring>` is rejected at TWO layers:
 *   1. The route checks the subcommand against the allowlist —
 *      unknown values → 400.
 *   2. The docker-bridge (`./bridge.ts`) re-runs the same check
 *      AND scans the rendered argv for a literal `bash -c` pair
 *      (defence in depth).
 *
 * M3 swap: replace the `defaultExecutor` in the bridge with the
 * real `executeRootCommand` that runs the rendered argv in the
 * sandbox.
 *
 * Method gating: only POST. GET/DELETE/PATCH respond 405.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import {
  dispatch,
  _STUB_MARKER,
} from '$lib/server/docker/bridge';
import { actionHashFor } from '$lib/server/approval';
import { getContainerById, getContainerByName } from '$lib/server/docker/real-data';
import { requireAdmin } from '$lib/server/auth';

async function loadContainer(id: string) {
  if (!id) return null;
  return (await getContainerById(id)) ?? (await getContainerByName(id));
}

const ALLOWED_SUBCOMMANDS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'ls -la', label: 'ls -la' },
  { value: 'ps auxf', label: 'ps auxf' },
  { value: 'df -h', label: 'df -h' },
  { value: 'uptime', label: 'uptime' },
  { value: 'cat /etc/os-release', label: 'cat /etc/os-release' },
  { value: 'whoami', label: 'whoami' },
  { value: 'hostname', label: 'hostname' },
];

/** Re-export the allowlist for the page that lists them in the UI. */
export const _ALLOWED_SUBCOMMANDS = ALLOWED_SUBCOMMANDS;

const ExecInput = z.object({
  subcommand: z.string().min(1).max(512),
  approvalToken: z.string().min(1).max(2048),
});

/** Reject subcommands that aren't in the allowlist (PB-2 layer 1). */
function isAllowedSubcommand(s: string): boolean {
  return ALLOWED_SUBCOMMANDS.some((opt) => opt.value === s);
}

function methodNotAllowed(): Response {
  return new Response('Method not allowed', { status: 405, headers: { allow: 'POST' } });
}

export const POST: RequestHandler = async ({ params, request, locals, getClientAddress }) => {
  // requireAdmin is the PB-5 layer 1. The bridge's approval-token
  // check is layer 2.
  const user = requireAdmin({ params, request, url: new URL(request.url), locals } as never);
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ message: 'Missing container identifier' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const c = await loadContainer(id);
  if (!c) {
    return new Response(JSON.stringify({ message: `Container '${id}' not found` }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Parse + validate the body. formData first (the page form posts
  // as application/x-www-form-urlencoded), fall back to JSON.
  const ct = request.headers.get('content-type') ?? '';
  let raw: Record<string, unknown> = {};
  try {
    if (ct.includes('application/json')) {
      raw = (await request.json()) as Record<string, unknown>;
    } else {
      const fd = await request.formData();
      raw = Object.fromEntries(fd.entries());
    }
  } catch {
    return new Response(JSON.stringify({ message: 'Malformed body' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const parsed = ExecInput.safeParse(raw);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        message: 'Validation failed',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.') || '_root',
          message: i.message,
        })),
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }
  const { subcommand, approvalToken } = parsed.data;

  // PB-2 layer 1: reject subcommands not in the allowlist.
  if (!isAllowedSubcommand(subcommand)) {
    return new Response(
      JSON.stringify({
        message: `Subcommand '${subcommand}' is not in the allowlist`,
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  // PB-2 layer 1.5: reject any literal `bash -c` substring. The
  // allowlist doesn't include `bash` so this is redundant, but it
  // catches a future caller that extends the allowlist without
  // thinking about bash.
  if (/(^|\s)(bash|sh|zsh|ksh)\s+-c\b/.test(subcommand)) {
    return new Response(
      JSON.stringify({
        message: 'No `bash -c <userstring>` from the UI (PB-2 / SR-019)',
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  // PB-5: compute the action-hash the bridge expects. The bridge
  // re-derives this internally; the client mints a token bound to
  // the same hash.
  const args = { container: c.name, command: subcommand };
  const expectedActionHash = actionHashFor('docker.exec', { op: 'docker.exec', args });

  // Run through the docker-bridge. The bridge re-validates the
  // allowlist (PB-2 layer 2), scans argv (PB-2 layer 2.5), verifies
  // + consumes the approval token (PB-5 layer 2), then dispatches.
  const result = await dispatch(
    {
      op: 'docker.exec',
      args,
      approvalToken,
      sessionId: locals.session?.id ?? null,
    },
    {
      user,
      ip: getClientAddress(),
      userAgent: request.headers.get('user-agent'),
      requestId: request.headers.get('x-request-id') ?? '',
    },
  );

  if (result.status === 'rejected') {
    const status = result.code === 'missing_approval' || result.code === 'invalid_approval' ? 403 : 400;
    return new Response(
      JSON.stringify({
        message: result.reason,
        code: result.code,
      }),
      { status, headers: { 'content-type': 'application/json' } },
    );
  }

  // status === 'accepted'
  return json({
    ok: true,
    op: result.op,
    argv: result.argv,
    output: result.output,
    durationMs: result.durationMs,
    stubMarker: _STUB_MARKER,
    expectedActionHash,
  });
};

export const GET: RequestHandler = () => methodNotAllowed();
export const PUT: RequestHandler = () => methodNotAllowed();
export const PATCH: RequestHandler = () => methodNotAllowed();
export const DELETE: RequestHandler = () => methodNotAllowed();
