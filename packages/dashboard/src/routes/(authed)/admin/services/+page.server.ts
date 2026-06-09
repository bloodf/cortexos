/**
 * /admin/services — admin view of the services catalog.
 */
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db/client';
import { listServices, listCategories } from '$lib/server/db/repos/services';
import { adaptServiceList } from '$lib/components/services/adapter';
import type { AdapterInput } from '$lib/components/services/adapter';

export const load: PageServerLoad = async () => {
	const db = getDb();
	const { rows } = await listServices(db, { activeOnly: false, pageSize: 500 });
	const categories = await listCategories(db, { activeOnly: false });
	return {
		services: adaptServiceList(rows as AdapterInput[]),
		categories,
	};
};
