/**
 * /services — list page server load.
 *
 * Loads the full services catalog (one shot; the list is small) and
 * returns both the rows and the union of categories. Filtering,
 * search, and sort are handled client-side by the DataTable primitive
 * — the server only does the initial fetch and the URL-driven
 * bootstrap.
 *
 * Data source: in-memory `stub-data` for M2. M3 will swap to the
 * Drizzle repo (`repos/services.ts`) and to `locals.db`.
 */
import type { PageServerLoad } from './$types';
import { listServices } from '$lib/server/stub-data';
import {
	adaptServiceList,
	uniqueCategories,
} from '$lib/components/services/adapter';

export const load: PageServerLoad = async ({ url }) => {
	// Read the URL-driven bootstrap (used to deep-link a search).
	const initialQuery = url.searchParams.get('q') ?? '';
	const initialCategory = url.searchParams.get('category') ?? '';

	// The stub returns mock `Service` (mock shape, not contracts).
	// Adapt to the contracts shape at the server boundary so the
	// client code never sees the mock types.
	const rows = adaptServiceList(listServices());
	const categories = uniqueCategories(rows);

	return {
		services: rows,
		categories,
		initialQuery,
		initialCategory,
	};
};
