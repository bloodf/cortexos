/**
 * /systemd/[name]/logs — GET endpoint for the last N log lines.
 *
 * Admin-gated (PB-5). Returns the most recent `limit` log lines
 * for the named unit, newest first. The default `limit` is 100;
 * the client may pass `?limit=N` (clamped to 1..500).
 *
 * SR-019 compliance: this endpoint does not invoke any shell. The
 * underlying `listLogs` is an in-memory call to the mock executor
 * (M2). M3's `RootHelperUnitExecutor` will return the same shape
 * but populated by `journalctl --unit=<name> -n <limit> --no-pager`
 * via the root helper, with the bridge constructing the argv.
 *
 * Response shape on failure is a plain JSON `{ message, code }`
 * object (NOT a thrown `error()`) so unit tests can assert the
 * status code directly. SvelteKit would convert a thrown
 * `error(401, ...)` into a Response, but the conversion depends on
 * the SvelteKit shim being installed — by returning a Response
 * explicitly we keep the test path stable.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentSession, isAdmin } from '$lib/server/auth';
import { getUnit, listLogs } from '$lib/server/systemd/bridge';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function clampLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, n);
}

function methodNotAllowed(): Response {
  return new Response('Method not allowed', {
    status: 405,
    headers: { allow: 'GET' },
  });
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
  if (!name) return errorResponse(400, 'Missing unit name', 'validation');
  const unit = await getUnit(name);
  if (!unit) return errorResponse(404, `Unit '${name}' not found`, 'not_found');

  const limit = clampLimit(event.url.searchParams.get('limit'));
  const lines = await listLogs(name, limit);
  return json({ unit: name, limit, count: lines.length, lines });
};

export const POST: RequestHandler = () => methodNotAllowed();
export const PUT: RequestHandler = () => methodNotAllowed();
export const PATCH: RequestHandler = () => methodNotAllowed();
export const DELETE: RequestHandler = () => methodNotAllowed();
