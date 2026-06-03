/**
 * /services/[id] — single-service detail page server load + actions.
 *
 * The URL parameter is the service's `slug` (URL-friendly, stable
 * across DB migrations). The stub store also exposes a numeric
 * `id`; we try the slug first, then the integer id as a fallback.
 *
 * Actions:
 *   - `recheck` — appends a fresh health snapshot (status='checking')
 *     to the in-memory history. In M3 this dispatches a probe via
 *     the root helper.
 */
import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import {
	getServiceBySlug,
	getServiceById,
	triggerRecheck,
	listHealthForService,
} from '$lib/server/stub-data';
import {
	adaptService,
	adaptHealthSnapshot,
	adaptHealthSnapshotList,
} from '$lib/components/services/adapter';
import type { Service as StubService, ServiceHealthSnapshot as StubSnapshot } from '$lib/server/entities';

function loadService(slugOrId: string): StubService | null {
	// Slug is the canonical URL identifier; try it first.
	const bySlug = getServiceBySlug(slugOrId);
	if (bySlug) return bySlug;
	// Fallback: the URL may carry a numeric id (legacy links).
	return getServiceById(slugOrId);
}

export const load: PageServerLoad = async ({ params }) => {
	const id = params.id;
	if (!id) throw error(400, 'Missing service identifier');
	const svc = loadService(id);
	if (!svc) throw error(404, `Service '${id}' not found`);

	const service = adaptService(svc);
	const history = adaptHealthSnapshotList(listHealthForService(svc.id, 50));

	return {
		service,
		history,
	};
};

export const actions: Actions = {
	/**
	 * Form action: trigger a fresh health check. Returns the new
	 * snapshot so the page can update without a full reload.
	 */
	recheck: async ({ params }) => {
		const id = params.id;
		if (!id) return fail(400, { error: 'Missing service identifier' });
		const svc = loadService(id);
		if (!svc) return fail(404, { error: `Service '${id}' not found` });
		// The stub always returns a `checking` snapshot. The M3 probe
		// path will replace this with a real round-trip.
		const snap: StubSnapshot = triggerRecheck(svc.id);
		return { ok: true, snapshot: adaptHealthSnapshot(snap) };
	},
};
