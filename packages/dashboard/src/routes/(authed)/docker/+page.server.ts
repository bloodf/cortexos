/**
 * /docker — list page server load.
 *
 * Loads the full container list (one shot; the list is small) and
 * returns both the rows and the unique state set. Filtering and
 * search are handled client-side by the DataTable primitive and
 * the ContainerSearch component.
 *
 * Data source: in-memory `$lib/server/docker/stub-data` for M2.
 * M3 will swap to the Drizzle repo (`repos/docker.ts`) and to
 * `locals.db`.
 */
import type { PageServerLoad } from './$types';
import { listContainers } from '$lib/server/docker/stub-data';
import { adaptContainerList, type ContainerStateLit } from '$lib/components/docker/adapter';

export const load: PageServerLoad = async ({ url }) => {
  const initialQuery = url.searchParams.get('q') ?? '';
  const stateParam = url.searchParams.get('state') ?? 'all';
  // Coerce unknown values to 'all' — defence against the URL being
  // tampered with. The UI accepts `'stopped'` (a union of exited
  // | created | dead) in addition to the contracts state union.
  const allowed: ReadonlyArray<ContainerStateLit | 'all' | 'stopped'> = [
    'all',
    'stopped',
    'running',
    'exited',
    'paused',
    'restarting',
    'dead',
    'created',
    'removing',
  ];
  const initialState = (allowed as ReadonlyArray<string>).includes(stateParam)
    ? (stateParam as ContainerStateLit | 'all' | 'stopped')
    : 'all';

  // Map the UI's `state` filter to the stub's `ContainerFilter`.
  // `running` is direct; `stopped` collapses to `exited | created | dead`.
  const filter =
    initialState === 'stopped'
      ? 'stopped'
      : initialState === 'all'
        ? 'all'
        : (initialState as 'paused' | 'restarting');

  const rows = adaptContainerList(listContainers({ filter, query: initialQuery }));

  return {
    containers: rows,
    initialQuery,
    initialState,
  };
};
