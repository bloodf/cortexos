/**
 * /api/systemd/actions — PB-5.
 *
 * Per THREAT_MODEL §1.2 surface 4, T-030..T-032, PB-5:
 *   - admin-only
 *   - allowlisted actions only
 *   - unit name allowlisted + no homoglyphs (SR-030, T-030)
 *   - critical units (cortex-dashboard, tailscaled, caddy, postgresql) require
 *     an approval token (SR-120)
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { allowlistedCommand, validateShellArg } from '$lib/server/policy';
import { validationError, approvalRequiredError } from '$lib/server/errors/types';
import { dispatchAction as dispatchSystemd } from '$lib/server/systemd/bridge';
import { mintApproval } from '$lib/server/approval';

const ActionInput = z.object({
  action: z.enum(['start', 'stop', 'restart', 'reload', 'status', 'enable', 'disable', 'list-units']),
  unit: z.string().min(1).max(128).optional(),
});

const VALID_SYSTEMD_UNIT = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*(\.service|\.timer|\.socket|\.target|\.mount|\.path|\.slice)$/;

const CRITICAL_UNITS: ReadonlySet<string> = new Set([
  'cortex-dashboard.service',
  'tailscaled.service',
  'caddy.service',
  'postgresql.service',
  'cortex-root-helper.service',
]);

export const POST = defineRoute({
  methods: ['POST'],
  input: ActionInput,
  auth: 'admin',
  surface: 'systemd',
  action: 'systemd.action',
  target: (i) => `${i.action}:${i.unit ?? ''}`,
  rateLimit: { limit: 10, windowSec: 60, bucket: 'user' },
  handler: async ({ input, user, event }) => {
    const ip = event.getClientAddress();
    const userAgent = event.request.headers.get('user-agent');
    const requestId = (event.locals as { requestId?: string }).requestId ?? '';

    // 1. Unit name validation — strict allowlist (SR-030, T-030).
    if (input.unit) {
      if (!VALID_SYSTEMD_UNIT.test(input.unit)) {
        throw validationError(`Invalid systemd unit name: ${input.unit}`, [
          { field: 'unit', message: 'must match a valid systemd unit pattern' },
        ]);
      }
      const r = validateShellArg(input.unit);
      if (!r.ok) {
        throw validationError('Unit name fails arg validation', [
          { field: 'unit', message: `${r.reason} (matched: ${r.matched})` },
        ]);
      }
    }

    // 2. Allowlist.
    const opName = `systemd.${input.action}`;
    const entry = allowlistedCommand(opName);
    if (!entry) {
      throw validationError(`Unsupported systemd action: ${input.action}`, [
        { field: 'action', message: 'not in allowlist' },
      ]);
    }

    // 3. Approval gate for critical units (SR-120).
    if (input.unit && CRITICAL_UNITS.has(input.unit) && (input.action === 'restart' || input.action === 'stop')) {
      throw approvalRequiredError(`systemd.${input.action}:${input.unit}`, 60);
    }

    // 4. Hand off to the bridge. On Linux the executor shells out to
    //    /usr/bin/systemctl via execFile; on macOS / unit tests the
    //    M2 mock returns the argv and a synthetic updated unit.
    if (input.action === 'list-units') {
      // list-units is a pure load, no executor call needed — the page
      // server load calls listUnits() directly. For the API endpoint,
      // we just return the dispatcher accepting the request.
      return { action: input.action, unit: input.unit ?? null, status: 'accepted' };
    }
    if (!input.unit) {
      throw validationError('unit is required for this action', [
        { field: 'unit', message: 'required' },
      ]);
    }

    // Self-mint an approval token (PB-5). The bridge enforces
    // token verification on every op. The destructive paths
    // (critical-unit restart/stop) throw `approvalRequiredError`
    // above this line and never reach the executor.
    const sessionId = (event.locals as { session?: { id?: string } }).session?.id;
    const approvalToken = mintApproval({
      action: opName,
      payload: { action: opName, unit: input.unit },
      sessionId: (sessionId ?? 'api') as never,
      userId: String(user.id),
      ttlSec: 60,
    }).token;

    const result = await dispatchSystemd(
      {
        action: input.action as 'start' | 'stop' | 'restart' | 'reload' | 'status' | 'enable' | 'disable',
        name: input.unit,
      },
      { user, ip, userAgent, requestId, sessionId: sessionId ?? 'api', approvalToken },
    );

    if (result.status === 'rejected') {
      // The rejected result has no `field` (only `code` + `reason`).
      throw validationError(result.reason, [
        { field: 'op', message: result.code },
      ]);
    }
    if (result.status === 'approval_required') {
      // Destructive ops that reach the bridge (rather than the route
      // gate) surface as 403 with the action-hash so the UI can
      // request an approval token and re-submit.
      throw approvalRequiredError(result.actionHash, result.ttlSec);
    }
    // result.status === 'accepted'
    return {
      action: input.action,
      unit: input.unit,
      status: 'accepted' as const,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      unit_snapshot: result.unit,
    };
  },
});
