/**
 * /incus/wizard — multi-step create wizard server load + form action.
 *
 * The wizard renders a 5-step form (image → instance → network →
 * profile → review). Step state is client-side (the page's $state
 * `current` index); the server only loads the seed data (known
 * images, pools, bridges) and runs the launch action.
 *
 * The launch action validates the wizard's `IncusInstanceConfig`
 * body, runs the preflight report, and (on success) seeds a new
 * instance into the bridge's mock store.
 */
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  listImages,
  getInstance,
  runPreflightReport,
  _getMockExecutorForTests,
} from '$lib/server/incus/bridge';
import { getCurrentSession, isAdmin } from '$lib/server/auth';
import { getMessages } from '$lib/i18n';
import {
  IncusInstanceConfigSchema,
  type IncusInstanceConfig,
  type IncusImage,
} from '@cortexos/contracts';

const DEFAULT_POOLS = ['default', 'nvme', 'hdd'] as const;
const DEFAULT_BRIDGES = ['incusbr0'] as const;
const DEFAULT_ALIASES = ['ubuntu/24.04', 'debian/12', 'alpine/3.20'] as const;

export const load: PageServerLoad = async ({ cookies, request, url, locals }) => {
  const localeCookie = cookies.get('cortex-locale');
  const messages = getMessages((localeCookie as 'en' | 'es' | 'pt-br') ?? 'en');
  const images = await listImages();

  // Derive a starter config from the defaults + the first image.
  const firstAlias = images[0]?.aliases[0] ?? 'ubuntu/24.04';
  const defaultConfig: IncusInstanceConfig = {
    target: {
      mode: 'new',
      branch: 'main',
      ghOrg: 'cortexos',
      slug: '',
    },
    image: {
      alias: firstAlias,
      gastown: false,
      profiles: ['default'],
      pool: 'default',
    },
    hermes: { enabled: false, proxies: [] },
    network: { bridge: 'incusbr0', tailscale: true, webAccess: false },
  };

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
    images,
    pools: DEFAULT_POOLS,
    bridges: DEFAULT_BRIDGES,
    aliases: DEFAULT_ALIASES,
    defaultConfig,
    isAdmin: isAdminFlag,
    messages,
  };
};

export const actions: Actions = {
  /**
   * `preflight` — run a deterministic preflight on the posted
   * `IncusInstanceConfig`. Returns the report. The page renders
   * the report in the review step.
   */
  preflight: async (event) => {
    const fd = await event.request.formData();
    const raw = fd.get('config');
    if (typeof raw !== 'string') {
      return fail(400, { error: 'Missing config' });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fail(400, { error: 'Invalid config JSON' });
    }
    const result = IncusInstanceConfigSchema.safeParse(parsed);
    if (!result.success) {
      return fail(400, {
        error: 'Invalid config shape',
        issues: result.error.issues,
      });
    }
    const report = await runPreflightReport(result.data);
    return { ok: true, report };
  },

  /**
   * `launch` — provision the instance. M2 inserts the new
   * `IncusInstance` into the bridge's mock store + runs preflight
   * + transitions the status through the provisioning sequence.
   * M3 swaps to the real `incus launch` via the root helper.
   */
  launch: async (event) => {
    const resolved = await getCurrentSession(event);
    if (!resolved) return fail(401, { error: 'Authentication required' });
    if (!isAdmin(resolved.user)) {
      return fail(403, { error: 'Admin role required' });
    }
    const fd = await event.request.formData();
    const raw = fd.get('config');
    if (typeof raw !== 'string') {
      return fail(400, { error: 'Missing config' });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fail(400, { error: 'Invalid config JSON' });
    }
    const result = IncusInstanceConfigSchema.safeParse(parsed);
    if (!result.success) {
      return fail(400, {
        error: 'Invalid config shape',
        issues: result.error.issues,
      });
    }
    const config = result.data;
    const name = config.target.slug;
    if (await getInstance(name)) {
      return fail(409, { error: `Instance '${name}' already exists` });
    }
    const report = await runPreflightReport(config);
    if (!report.ok) {
      return fail(400, { error: 'Preflight failed', report });
    }
    // Seed the new instance in the mock store. The store's
    // `setExecutorForTests` API is the only write path; in
    // production the executor + DB do the insert. The mock's
    // `snapshot` returns the inserted record.
    const mock = _getMockExecutorForTests();
    const now = new Date().toISOString();
    const inserted = {
      name,
      slug: name,
      status: 'provisioning' as const,
      type: 'container' as const,
      image: config.image.alias,
      cpu: config.image.cpu ?? null,
      memory: config.image.memory ?? null,
      config,
      devices: {
        root: { path: '/', pool: config.image.pool, type: 'disk' },
        eth0: { name: 'eth0', nictype: 'bridged', parent: config.network.bridge, type: 'nic' },
      },
      lastValidation: { ok: true, ranAt: now, notes: 'wizard launch (mock)' },
      createdBy: resolved.user.id,
      createdAt: now,
      updatedAt: now,
      allowlisted: true,
    };
    mock.seed([inserted]);
    return { ok: true, name, status: 'provisioning' };
  },
};

// Suppress the unused import lint for the actions-typed image shape
// (used inside the action handlers).
void (null as unknown as IncusImage);
