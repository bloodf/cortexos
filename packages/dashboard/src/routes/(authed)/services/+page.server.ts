/**
 * /services — list page server load.
 *
 * Loads the full services catalog from the DB and returns both the
 * rows and the union of categories. Filtering, search, and sort are
 * handled client-side by the DataTable primitive.
 */
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db/client';
import { listServices, listCategories } from '$lib/server/db/repos/services';
import { adaptServiceList } from '$lib/components/services/adapter';
import type { AdapterInput } from '$lib/components/services/adapter';

export const load: PageServerLoad = async ({ url }) => {
	const initialQuery = url.searchParams.get('q') ?? '';
	const initialCategory = url.searchParams.get('category') ?? '';

	const db = getDb();
	const { rows } = await listServices(db, { activeOnly: true, pageSize: 500 });
	const categories = await listCategories(db, { activeOnly: true });

	return {
		services: adaptServiceList(rows as AdapterInput[]),
		categories,
		initialQuery,
		initialCategory,
	};
};
