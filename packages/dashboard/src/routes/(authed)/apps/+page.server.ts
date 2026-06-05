/**
 * /apps — launcher surface server load.
 *
 * Lists every Service catalog entry with `kind = 'dashboard-launcher'`.
 * These are link-out surfaces (Hermes Web UI, BoxBox, ...) that the
 * dashboard surfaces as openable tiles; the click target is the
 * `openUrl` field (a path that Caddy reverse-proxies to the upstream
 * — see `prompts/tools/30-hermes-webui.md` and `30c-boxbox.md`).
 *
 * Data source:
 *   - M2/dev: in-memory `stub-data.listDashboardLaunchers()`.
 *   - M3/prod: Drizzle repo `repos/services.ts listServices({ kind: 'dashboard-launcher' })`
 *     against `locals.db`. Wired the same way `services/+page.server.ts`
 *     is wired — both pages read from the same catalog, just with a
 *     different filter. The migration `009_hermes_webui_boxbox_seed.sql`
 *     seeds the rows on the prod path.
 *
 * RBAC: any authenticated user can list launchers — the entries are
 * public to the same audience as the /services page.
 */
import type { PageServerLoad } from './$types';
import { listDashboardLaunchers } from '$lib/server/stub-data';

export const load: PageServerLoad = async () => {
  return {
    launchers: listDashboardLaunchers(),
  };
};
