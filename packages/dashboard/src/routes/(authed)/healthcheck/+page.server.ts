/**
 * /healthcheck — healthcheck surface server load.
 *
 * Loads services flagged for healthcheck plus recent alert history.
 */
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db/client';
import { listServices } from '$lib/server/db/repos/services';
import { listAlertHistoryWithNames } from '$lib/server/db/repos/alerts';
import { adaptServiceList } from '$lib/components/services/adapter';
import type { AdapterInput } from '$lib/components/services/adapter';

export const load: PageServerLoad = async () => {
	const db = getDb();
	const { rows } = await listServices(db, { activeOnly: true, pageSize: 500 });
	const filtered = rows.filter((r) => r.showInHealthcheck);

	const [services, alerts] = await Promise.all([
		Promise.resolve(adaptServiceList(filtered as AdapterInput[])),
		listAlertHistoryWithNames(db, { limit: 50 }),
	]);

	return {
		services,
		alerts,
	};
};
