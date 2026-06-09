/**
 * /docker — list page server load.
 *
 * Loads the full container list from the live Docker socket.
 */
import type { PageServerLoad } from './$types';
import { listContainers, listImages, listVolumes } from '$lib/server/docker/real-data';
import { adaptContainerList, type ContainerStateLit } from '$lib/components/docker/adapter';

export const load: PageServerLoad = async ({ url }) => {
  const initialQuery = url.searchParams.get('q') ?? '';
  const stateParam = url.searchParams.get('state') ?? 'all';
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

  const filter =
    initialState === 'stopped'
      ? 'stopped'
      : initialState === 'all'
        ? 'all'
        : (initialState as 'paused' | 'restarting');

  const rows = adaptContainerList(await listContainers({ filter, query: initialQuery }));
  const images = await listImages({ query: initialQuery });
  const volumes = await listVolumes({ query: initialQuery });

  return {
    containers: rows,
    images,
    volumes,
    initialQuery,
    initialState,
  };
};
