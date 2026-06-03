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
  handler: async ({ input }) => {
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

    return {
      action: input.action,
      unit: input.unit ?? null,
      argv: entry.argv,
      status: 'accepted',
      message: 'M1 stub: systemctl dispatch lands in M3',
    };
  },
});
