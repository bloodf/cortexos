/**
 * /docker/[id]/exec — page server load.
 *
 * Mints an approval token for the exec form (PB-5). The token is
 * bound to the canonical action-hash that the docker-bridge
 * recomputes when the form posts.
 *
 * Note: this page-level `load()` runs in addition to the
 * +server.ts POST handler; the +server.ts is the action
 * endpoint, this file is the page render.
 */
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getContainerById, getContainerByName } from '$lib/server/docker/stub-data';
import { adaptContainer } from '$lib/components/docker/adapter';
import { actionHashFor, mintApproval } from '$lib/server/approval';

// Mirror the allowlist from the +server.ts. Kept in sync by hand
// (the contracts package will move this to the policy module in
// M3).
const ALLOWED_SUBCOMMANDS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'ls -la', label: 'ls -la' },
  { value: 'ps auxf', label: 'ps auxf' },
  { value: 'df -h', label: 'df -h' },
  { value: 'uptime', label: 'uptime' },
  { value: 'cat /etc/os-release', label: 'cat /etc/os-release' },
  { value: 'whoami', label: 'whoami' },
  { value: 'hostname', label: 'hostname' },
];

function loadContainer(id: string) {
  if (!id) return null;
  return getContainerById(id) ?? getContainerByName(id);
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
  const id = params.id;
  if (!id) throw error(400, 'Missing container identifier');
  const c = loadContainer(id);
  if (!c) throw error(404, `Container '${id}' not found`);

  // PB-5: only admins get the exec page. Non-admins are redirected
  // to the detail page (where they can still see the inspect view).
  // The contracts `User` shape diverges from the local branded
  // `User` (no `groupMemberships` on contracts); cast at the
  // boundary.
  const cu = locals.user as unknown as { id: string; isAdmin: boolean; groupMemberships?: string[] } | null;
  const cs = locals.session as unknown as { id: string } | null;
  const isAdmin = Boolean(
    cu && (cu.isAdmin || (cu.groupMemberships?.includes('cortexos-admin') ?? false)),
  );
  if (!isAdmin) {
    throw redirect(303, `/docker/${encodeURIComponent(c.id as unknown as string)}`);
  }

  // PB-5: mint an approval token bound to the canonical action
  // hash the bridge will recompute on POST. ttl=60s, single use.
  // The bridge re-derives the same hash from `docker.exec` +
  // args and verifies the token — both sides must agree on the
  // hash algorithm (see actionHashFor in $lib/server/approval).
  const args = { container: c.name, command: '' };
  const sessionId = cs?.id;
  const userId = cu?.id;
  const token = sessionId && userId
    ? mintApproval({
        action: 'docker.exec',
        payload: { op: 'docker.exec', args },
        sessionId: sessionId as never,
        userId: userId as never,
        ttlSec: 60,
      })
    : '';
  // The action hash for an empty `command` is fine; the bridge
  // re-derives it from the actual command in the form.
  const expectedActionHash = actionHashFor('docker.exec', { op: 'docker.exec', args });

  return {
    container: adaptContainer({
      id: c.id as unknown as string,
      name: c.name,
      image: c.image,
      state: c.state,
      status: c.status,
      ports: c.ports,
      created: c.created,
      privileged: c.privileged,
      networks: c.networks,
      mounts: c.mounts,
    }),
    allowedSubcommands: ALLOWED_SUBCOMMANDS,
    approvalToken: token,
    expectedActionHash,
    returnTo: url.searchParams.get('returnTo') ?? `/docker/${encodeURIComponent(c.id as unknown as string)}`,
  };
};
