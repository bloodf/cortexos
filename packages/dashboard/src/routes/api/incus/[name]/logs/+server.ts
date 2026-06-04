/**
 * /api/incus/[name]/logs — admin-gated GET for the last N log lines.
 *
 * Mirrors the systemd equivalent (`/systemd/[name]/logs/+server.ts`):
 * admin-gated, returns the most recent `limit` log lines for the
 * named instance, newest first. The default `limit` is 100; the
 * client may pass `?limit=N` (clamped to 1..500).
 *
 * SR-019 compliance: this endpoint does not invoke any shell. The
 * underlying `listInstanceLogs` is an in-memory call to the mock
 * executor (M2). M3's `RootHelperIncusExecutor` will return the
 * same shape but populated by `incus query /1.0/instances/<name>
 * ?output=json` via the root helper, with the bridge constructing
 * the argv.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentSession, isAdmin } from '$lib/server/auth';
import { getInstance, listInstanceLogs } from '$lib/server/incus/bridge';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function clampLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, n);
}

function errorResponse(status: number, message: string, code: string): Response {
  return new Response(JSON.stringify({ message, code }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export const GET: RequestHandler = async (event) => {
  const resolved = await getCurrentSession(event);
  if (!resolved) return errorResponse(401, 'Authentication required', 'auth');
  if (!isAdmin(resolved.user)) return errorResponse(403, 'Admin role required', 'permission');

  const name = event.params.name;
  if (!name) return errorResponse(400, 'Missing instance name', 'validation');
  const instance = await getInstance(name);
  if (!instance) return errorResponse(404, `Instance '${name}' not found`, 'not_found');

  const limit = clampLimit(event.url.searchParams.get('limit'));
  const lines = await listInstanceLogs(name, limit);
  return json({ instance: name, limit, count: lines.length, lines });
};

export const POST: RequestHandler = () =>
  new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
export const PUT: RequestHandler = () =>
  new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
export const PATCH: RequestHandler = () =>
  new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
export const DELETE: RequestHandler = () =>
  new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
