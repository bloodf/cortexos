/**
 * /incus — list page server load.
 *
 * Loads the full instance list (one shot; the list is small) and
 * returns it with the URL-driven filter bootstrap (`?q=`, `?status=`,
 * `?type=`). Filtering itself happens client-side; the server
 * only does the initial fetch.
 *
 * Data source: the incus bridge in `$lib/server/incus/bridge.ts`.
 * The bridge's M2 mock returns the seeded + mutated snapshot; M3
 * will swap to a `RootHelperIncusExecutor` without touching this
 * loader.
 */
import type { PageServerLoad } from './$types';
import { listInstances, listImages } from '$lib/server/incus/bridge';
import { getCurrentSession, isAdmin } from '$lib/server/auth';
import { getMessages } from '$lib/i18n';
import {
  filterByQuery,
  filterByStatus,
  filterByType,
  type StatusFilter,
  type TypeFilter,
  type IncusStatusLit,
} from '$lib/components/incus/adapter';
import { INCUS_STATUSES, INCUS_TYPES } from '$lib/components/incus/adapter';

const DEFAULT_STATUS: StatusFilter = 'all';
const DEFAULT_TYPE: TypeFilter = 'all';

function parseStatusFilter(input: string | null): StatusFilter {
  if (input == null) return DEFAULT_STATUS;
  if ((INCUS_STATUSES as readonly string[]).includes(input)) return input as IncusStatusLit;
  return DEFAULT_STATUS;
}

function parseTypeFilter(input: string | null): TypeFilter {
  if (input == null) return DEFAULT_TYPE;
  if ((INCUS_TYPES as readonly string[]).includes(input)) return input as TypeFilter;
  return DEFAULT_TYPE;
}

export const load: PageServerLoad = async ({ url, cookies, request, locals }) => {
  // Read locale from the standard cookie.
  const localeCookie = cookies.get('cortex-locale');
  const messages = getMessages((localeCookie as 'en' | 'es' | 'pt-br') ?? 'en');

  const q = url.searchParams.get('q') ?? '';
  const status = parseStatusFilter(url.searchParams.get('status'));
  const type = parseTypeFilter(url.searchParams.get('type'));

  const all = await listInstances();
  const images = await listImages();

  // Apply filters on the server so the page renders the right
  // initial state — the URL is the single source of truth.
  const filtered = filterByType(filterByStatus(filterByQuery(all, q), status), type);

  // Resolve the session for the admin flag (used by the page's
  // "New instance" CTA).
  const resolved = await getCurrentSession({
    cookies,
    request,
    url,
    params: {},
    route: { id: null },
    locals,
    getClientAddress: () => '127.0.0.1',
  });
  const isAdminFlag = resolved ? isAdmin(resolved.user) : false;

  return {
    instances: filtered,
    total: all.length,
    q,
    status,
    type,
    isAdmin: isAdminFlag,
    images,
    messages,
  };
};
