/**
 * /incus/[name] — single-instance detail page server load + form actions.
 *
 * Loads the instance + the last 50 log lines from the incus bridge.
 * Form actions: `start`, `stop`, `restart`, `delete`. All require
 * admin (PB-5) and a valid approval token for the destructive
 * subset (stop, restart, delete). Delete additionally requires a
 * typed confirmation phrase.
 *
 * PB-5 + SR-019:
 *   - Every action calls `dispatchAction` from the incus bridge.
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
  getInstance,
  listInstanceLogs,
  type DispatchInput,
  type IncusActionKind,
} from '$lib/server/incus/bridge';
import { getCurrentSession, isAdmin } from '$lib/server/auth';
import { getMessages } from '$lib/i18n';
import type { IncusInstance } from '@cortexos/contracts';

const ALLOWED_ACTIONS: ReadonlySet<IncusActionKind> = new Set<IncusActionKind>([
  'start',
  'stop',
  'restart',
  'delete',
]);

const LOG_LIMIT = 50;

function isActionKind(input: unknown): input is IncusActionKind {
  return typeof input === 'string' && ALLOWED_ACTIONS.has(input as IncusActionKind);
}

export const load: PageServerLoad = async ({ params, cookies, request, url, locals }) => {
  const name = params.name;
  if (!name) throw error(400, 'Missing instance name');
  const instance = await getInstance(name);
  if (!instance) throw error(404, `Instance '${name}' not found`);
  const logs = await listInstanceLogs(name, LOG_LIMIT);

  const localeCookie = cookies.get('cortex-locale');
  const messages = getMessages((localeCookie as 'en' | 'es' | 'pt-br') ?? 'en');

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
    instance,
    logs,
    isAdmin: isAdminFlag,
    messages,
  };
};

export const actions: Actions = {
  /**
   * Generic action handler for the 4 instance lifecycle actions.
   * The action name comes from `formData.get('action')` so the
   * form layer can build a single `<form action="?/default">`
   * with hidden inputs.
   */
  default: async (event) => {
    const fd = await event.request.formData();
    const rawAction = fd.get('action');
    if (!isActionKind(rawAction)) {
      return fail(400, { error: `Unknown action '${String(rawAction)}'` });
    }
    const action: IncusActionKind = rawAction;
    const name = (fd.get('name') as string | null) ?? event.params.name;
    if (!name) return fail(400, { error: 'Missing instance name' });

    // PB-5: admin gate.
    const resolved = await getCurrentSession(event);
    if (!resolved) return fail(401, { error: 'Authentication required' });
    if (!isAdmin(resolved.user)) {
      return fail(403, { error: 'Admin role required' });
    }
    if (!resolved.session?.id) {
      return fail(401, { error: 'Session id missing — sign in again' });
    }

    const approvalToken = (fd.get('approvalToken') as string | null) ?? undefined;
    const confirmation = (fd.get('confirmation') as string | null) ?? undefined;

    const input: DispatchInput = {
      action,
      name,
      ...(confirmation ? { confirmation } : {}),
    };
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
      return { ok: true, action, name, instance: result.instance as IncusInstance };
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
