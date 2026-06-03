/**
 * /api/incus/actions — PB-5.
 *
 * Per THREAT_MODEL §1.2 surface 6, T-050, T-052, PB-5:
 *   - admin-only
 *   - allowlisted actions only
 *   - instance name allowlisted (SR-030, T-050)
 *   - destructive ops (delete, restart on critical) require approval
 *   - profiles must be in the curated set (SR-052)
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { allowlistedCommand, validateShellArg } from '$lib/server/policy';
import { validationError, approvalRequiredError } from '$lib/server/errors/types';

const ActionInput = z.object({
  action: z.enum(['start', 'stop', 'restart', 'delete', 'launch', 'list']),
  instance: z.string().min(1).max(64).optional(),
  profile: z.string().min(1).max(64).optional(),
});

const VALID_INCUS_NAME = /^[a-zA-Z0-9][a-zA-Z0-9-]*$/;
const ALLOWED_PROFILES: ReadonlySet<string> = new Set(['default', 'cortexos-isolated', 'cortexos-nested']);

export const POST = defineRoute({
  methods: ['POST'],
  input: ActionInput,
  auth: 'admin',
  surface: 'incus',
  action: 'incus.action',
  target: (i) => `${i.action}:${i.instance ?? ''}`,
  rateLimit: { limit: 10, windowSec: 60, bucket: 'user' },
  handler: async ({ input }) => {
    if (input.instance) {
      if (!VALID_INCUS_NAME.test(input.instance)) {
        throw validationError(`Invalid incus instance name: ${input.instance}`, [
          { field: 'instance', message: 'must match [a-zA-Z0-9][a-zA-Z0-9-]*' },
        ]);
      }
      const r = validateShellArg(input.instance);
      if (!r.ok) {
        throw validationError('Instance name fails arg validation', [
          { field: 'instance', message: `${r.reason} (matched: ${r.matched})` },
        ]);
      }
    }

    if (input.profile && !ALLOWED_PROFILES.has(input.profile)) {
      throw validationError(`Profile not in allowlist: ${input.profile}`, [
        { field: 'profile', message: 'not in SR-052 allowlist' },
      ]);
    }

    const opName = `incus.${input.action}`;
    const entry = allowlistedCommand(opName);
    if (!entry) {
      throw validationError(`Unsupported incus action: ${input.action}`, [
        { field: 'action', message: 'not in allowlist' },
      ]);
    }

    if (entry.requiresApproval) {
      throw approvalRequiredError(`incus.${input.action}:${input.instance ?? ''}`, 60);
    }

    return {
      action: input.action,
      instance: input.instance ?? null,
      profile: input.profile ?? null,
      argv: entry.argv,
      status: 'accepted',
      message: 'M1 stub: incus dispatch lands in M3',
    };
  },
});
