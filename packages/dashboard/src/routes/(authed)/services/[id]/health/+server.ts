/**
 * /services/[id]/health — POST triggers a fresh health check.
 *
 * The form action `?/recheck` (in `+page.server.ts`) is the primary
 * path for browser submissions. This `+server.ts` exists so external
 * clients (curl, scripts, the future xterm bridge) can hit the same
 * business logic with a plain POST.
 *
 * Method gating: only POST. GET/DELETE/PATCH respond 405.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getServiceBySlug,
	getServiceById,
	triggerRecheck,
} from '$lib/server/stub-data';
import { adaptHealthSnapshot } from '$lib/components/services/adapter';

function loadService(slugOrId: string) {
	const bySlug = getServiceBySlug(slugOrId);
	if (bySlug) return bySlug;
	return getServiceById(slugOrId);
}

function methodNotAllowed(): Response {
	return new Response('Method not allowed', {
		status: 405,
		headers: { allow: 'POST' },
	});
}

export const POST: RequestHandler = ({ params }) => {
	const id = params.id;
	if (!id) throw error(400, 'Missing service identifier');
	const svc = loadService(id);
	if (!svc) throw error(404, `Service '${id}' not found`);

	const snap = triggerRecheck(svc.id);
	return json({ ok: true, snapshot: adaptHealthSnapshot(snap) });
};

export const GET: RequestHandler = () => methodNotAllowed();
export const PUT: RequestHandler = () => methodNotAllowed();
export const PATCH: RequestHandler = () => methodNotAllowed();
export const DELETE: RequestHandler = () => methodNotAllowed();
