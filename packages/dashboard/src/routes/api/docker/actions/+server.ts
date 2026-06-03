/**
 * /api/docker/actions — PB-5.
 *
 * Per THREAT_MODEL §1.2 surface 5, T-040..T-042, PB-5:
 *   - admin-only
 *   - allowlisted actions only (no `pull` from the UI, SR-041)
 *   - container name allowlisted (SR-030, no homoglyphs)
 *   - `privileged: true` is a separate gated action (SR-042)
 *   - destructive ops require an approval token (SR-120)
 *
 * M1 stub: validates input, applies policy + arg validation, returns
 * the mapped argv. Real `docker` dispatch lands in M3.
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { allowlistedCommand, validateShellArg } from '$lib/server/policy';
import { validationError, approvalRequiredError } from '$lib/server/errors/types';

const ActionInput = z.object({
  action: z.enum(['start', 'stop', 'restart', 'rm', 'logs', 'inspect', 'list', 'privileged']),
  container: z.string().min(1).max(64).optional(),
});

const VALID_DOCKER_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;

export const POST = defineRoute({
  methods: ['POST'],
  input: ActionInput,
  auth: 'admin',
  surface: 'docker',
  action: 'docker.action',
  target: (i) => `${i.action}:${i.container ?? ''}`,
  rateLimit: { limit: 10, windowSec: 60, bucket: 'user' },
  handler: async ({ input }) => {
    // 1. Container name validation — strict allowlist (SR-030, T-040).
    //    No homoglyphs, no Unicode tricks.
    if (input.container) {
      if (!VALID_DOCKER_NAME.test(input.container)) {
        throw validationError(`Invalid container name: ${input.container}`, [
          { field: 'container', message: 'must match [a-zA-Z0-9][a-zA-Z0-9_.-]*' },
        ]);
      }
      // SR-104/T-104: arg-smuggling detection.
      const r = validateShellArg(input.container);
      if (!r.ok) {
        throw validationError('Container name fails arg validation', [
          { field: 'container', message: `${r.reason} (matched: ${r.matched})` },
        ]);
      }
    }

    // 2. Allowlist — `docker.<action>` must be registered.
    const opName = `docker.${input.action}`;
    const entry = allowlistedCommand(opName);
    if (!entry) {
      throw validationError(`Unsupported docker action: ${input.action}`, [
        { field: 'action', message: 'not in allowlist' },
      ]);
    }

    // 3. Approval gate for destructive / privileged.
    if (entry.requiresApproval) {
      throw approvalRequiredError(`docker.${input.action}:${input.container ?? ''}`, 60);
    }

    return {
      action: input.action,
      container: input.container ?? null,
      argv: entry.argv,
      status: 'accepted',
      message: 'M1 stub: docker dispatch lands in M3',
    };
  },
});
