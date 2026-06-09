/**
 * /apps — launcher surface server load.
 *
 * Lists the curated apps the operator installed via the CortexOS
 * prompts that have a user-facing surface — NOT raw host services.
 * An entry appears when:
 *   show_in_webui = true   (web-accessible app: grafana, 9router, …)
 *   OR kind = 'app'        (first-class app entries: nexusgate, …)
 *   OR kind = 'dashboard-launcher'  (link-out tiles: Hermes WebUI, BoxBox)
 *
 * Headless infrastructure (kind = 'service' | 'docker' | 'process'
 * with show_in_webui = false) belongs on /services, not here.
 */
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db/client';
import { listServices } from '$lib/server/db/repos/services';
import { adaptServiceList } from '$lib/components/services/adapter';
import type { AdapterInput } from '$lib/components/services/adapter';

export const load: PageServerLoad = async () => {
	const db = getDb();
	const { rows } = await listServices(db, { activeOnly: true, pageSize: 500 });
	const filtered = rows.filter(
		(r) => r.showInWebui === true || r.kind === 'app' || r.kind === 'dashboard-launcher',
	);

	return {
		services: adaptServiceList(filtered as AdapterInput[]),
	};
};
