/**
 * /docker/[id]/logs — GET the last N log lines for a container.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getContainerById, getContainerByName, tailLogs } from '$lib/server/docker/real-data';
import { requireAuth } from '$lib/server/auth';

async function loadContainer(id: string) {
  if (!id) return null;
  return (await getContainerById(id)) ?? (await getContainerByName(id));
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

export const GET: RequestHandler = async ({ params, url }) => {
  requireAuth({ params, url, locals: undefined } as never);
  const id = params.id;
  if (!id) return badRequestResponse('Missing container identifier');
  const c = await loadContainer(id);
  if (!c) return notFoundResponse(id);
  const tail = Math.max(1, Math.min(1000, Number(url.searchParams.get('n') ?? '100')));
  const lines = await tailLogs(c.id as unknown as string, tail);
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

export const _error = error;
