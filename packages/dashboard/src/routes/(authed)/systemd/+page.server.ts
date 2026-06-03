/**
 * /systemd — list page server load.
 *
 * Loads the full unit list (one shot; the list is small) and returns
 * it with the active/inactive/failed counts and the URL-driven
 * filter bootstrap (`?state=active|inactive|failed|all`). Filtering
 * itself happens client-side on the DataTable primitive; the
 * server only does the initial fetch.
 *
 * Data source: the systemd bridge in `$lib/server/systemd/bridge.ts`.
 * The bridge's M2 mock returns the seeded unit snapshot; M3 will
 * swap to a root-helper executor without touching this loader.
 */
import type { PageServerLoad } from './$types';
import { listUnits } from '$lib/server/systemd/bridge';
import { countByState, type StateFilter } from '$lib/components/systemd/adapter';

function parseStateFilter(input: string | null): StateFilter {
  if (input === 'active' || input === 'inactive' || input === 'failed') return input;
  return 'all';
}

export const load: PageServerLoad = async ({ url }) => {
  const state = parseStateFilter(url.searchParams.get('state'));
  const units = await listUnits();
  const counts = countByState(units);
  return {
    units,
    state,
    counts,
  };
};
