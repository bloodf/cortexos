/**
 * /docker/[id]/logs — GET the last N log lines for a container.
 *
 * Returns:
 *   {
 *     id: string;
 *     name: string;
 *     lines: string[];
 *     tail: number;
 *     fetchedAt: string;
 *   }
 *
 * M3 swap: replace `tailLogs` with `docker logs --tail <N> <id>` via
 * the docker-bridge executor.
 *
 * Method gating: only GET. POST/PUT/PATCH/DELETE respond 405.
 *
 * PB-5: this endpoint is read-only and does not require an approval
 * token. PB-2/SR-019: there is no `bash -c <userstring>` here — the
 * endpoint does not execute anything.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getContainerById, getContainerByName, tailLogs } from '$lib/server/docker/stub-data';
import { requireAuth } from '$lib/server/auth';

function loadContainer(id: string) {
  if (!id) return null;
  return getContainerById(id) ?? getContainerByName(id);
}

function notFoundResponse(id: string): Response {
  return new Response(JSON.stringify({ message: `Container '${id}' not found` }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  });
}

function badRequestResponse(message: string): Response {
  return new Response(JSON.stringify({ message }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
}

function methodNotAllowed(): Response {
  return new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
}

export const GET: RequestHandler = ({ params, url }) => {
  // requireAuth is called early so the auth gate shows up in the
  // audit log even if the container is missing. requireAuth throws
  // an apiError; SvelteKit converts it to the right HTTP status.
  requireAuth({ params, url, locals: undefined } as never);
  const id = params.id;
  if (!id) return badRequestResponse('Missing container identifier');
  const c = loadContainer(id);
  if (!c) return notFoundResponse(id);
  const tail = Math.max(1, Math.min(1000, Number(url.searchParams.get('n') ?? '100')));
  const lines = tailLogs(c.id as unknown as string, tail);
  return json({
    id: c.id,
    name: c.name,
    lines,
    tail,
    fetchedAt: new Date().toISOString(),
  });
};

export const POST: RequestHandler = () => methodNotAllowed();
export const PUT: RequestHandler = () => methodNotAllowed();
export const PATCH: RequestHandler = () => methodNotAllowed();
export const DELETE: RequestHandler = () => methodNotAllowed();

// Silence the unused-error import warning: the function exists for
// the auth helper; we keep it imported so future call-sites can
// use it.
export const _error = error;
