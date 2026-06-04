/**
 * /systemd/[name] — single-unit detail page server load + form actions.
 *
 * Loads the unit + the last 50 log lines from the systemd bridge.
 * Form actions: `start`, `stop`, `restart`, `reload`, `enable`,
 * `disable`. All require admin (PB-5) and a valid approval token
 * for the destructive subset (restart, stop, disable).
 *
 * PB-5 + SR-019:
 *   - Every action calls `dispatchAction` from the systemd bridge.
 *   - Destructive actions surface `approval_required` to the client;
 *     the client must fetch an approval token (HMAC-SHA256, action-
 *     hash bound) and re-submit. The bridge verifies the token's
 *     `actionHash` matches the call's action+name hash.
 *   - The bridge never constructs a `bash -c <userstring>` argv
 *     (the mock is in-process; the M3 root-helper executor inherits
 *     the same invariant via the policy allowlist).
 */
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
  dispatchAction,
  getUnit,
  listLogs,
  type DispatchInput,
} from '$lib/server/systemd/bridge';
import { getCurrentSession, isAdmin } from '$lib/server/auth';
import type { SystemdActionKind, SystemdUnit } from '@cortexos/contracts';

const ALLOWED_ACTIONS: ReadonlySet<SystemdActionKind> = new Set<SystemdActionKind>([
  'start',
  'stop',
  'restart',
  'reload',
  'enable',
  'disable',
]);

const LOG_LIMIT = 50;

function isActionKind(input: unknown): input is SystemdActionKind {
  return typeof input === 'string' && ALLOWED_ACTIONS.has(input as SystemdActionKind);
}

export const load: PageServerLoad = async ({ params, locals }) => {
  const name = params.name;
  if (!name) throw error(400, 'Missing unit name');
  const unit = await getUnit(name);
  if (!unit) throw error(404, `Unit '${name}' not found`);
  const logs = await listLogs(name, LOG_LIMIT);
  // The `Locals` interface in M2 carries the full contracts User,
  // not the legacy M1 stub. Cast to `unknown` first to keep svelte-check
  // happy without violating the type contract.
  const user = (locals as unknown as { user?: { groupMemberships?: string[]; isAdmin?: boolean; is_admin?: boolean } }).user ?? null;
  return {
    unit,
    logs,
    isAdmin: user
      ? isAdmin(user as never)
      : false,
  };
};

export const actions: Actions = {
  /**
   * Generic action handler for all 6 unit actions. The action name
   * comes from `formData.get('action')` so the form layer can build
   * a single `<form action="?/default">` with hidden inputs.
   *
   * Validates the action, gates admin, dispatches through the
   * bridge. Destructive actions surface `approval_required` to the
   * client; the page layer is responsible for fetching an approval
   * token and re-submitting.
   */
  default: async (event) => {
    const fd = await event.request.formData();
    const rawAction = fd.get('action');
    if (!isActionKind(rawAction)) {
      return fail(400, { error: `Unknown action '${String(rawAction)}'` });
    }
    const action: SystemdActionKind = rawAction;
    const name = (fd.get('name') as string | null) ?? event.params.name;
    if (!name) return fail(400, { error: 'Missing unit name' });

    // PB-5: admin gate. We check isAdmin directly (rather than
    // requireAdmin which throws) because SvelteKit form actions must
    // return a `fail(...)` value, not throw.
    const resolved = await getCurrentSession(event);
    if (!resolved) return fail(401, { error: 'Authentication required' });
    if (!isAdmin(resolved.user)) {
      return fail(403, { error: 'Admin role required' });
    }
    if (!resolved.session?.id) {
      return fail(401, { error: 'Session id missing — sign in again' });
    }

    const approvalToken = (fd.get('approvalToken') as string | null) ?? undefined;

    const input: DispatchInput = { action, name };
    const ctx = {
      user: resolved.user,
      ip: event.getClientAddress(),
      userAgent: event.request.headers.get('user-agent'),
      requestId: (event.locals as { requestId?: string }).requestId ?? '',
      sessionId: resolved.session.id,
      ...(approvalToken ? { approvalToken } : {}),
    };
    const result = await dispatchAction(input, ctx);

    if (result.status === 'accepted') {
      return { ok: true, action, name, unit: result.unit as SystemdUnit };
    }
    if (result.status === 'approval_required') {
      return fail(403, {
        error: result.message,
        approvalRequired: true,
        actionHash: result.actionHash,
        ttlSec: result.ttlSec,
        action,
        name,
      });
    }
    // rejected
    return fail(400, { error: result.reason, code: result.code, action, name });
  },
};
