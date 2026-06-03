/**
 * /api/incus/[name]/exec-named — PB-4 FIX.
 *
 * Replaces the old `/api/incus/[name]/shell` arbitrary-exec endpoint
 * (THREAT_MODEL §1.2 surface 6, T-051, PB-4) with a named-op allowlist.
 *
 *   - Same `term.exec_named` allowlist as `/api/terminal` (THREAT_MODEL §4.4.4)
 *   - admin-only (`requireAdmin`)
 *   - No `bash -c <userstring>` from UI
 *   - Arg validation (T-104) before policy.class check
 *
 * M1 stub: validates input, applies policy, returns the mapped argv.
 * Real `incus exec` dispatch lands in M3.
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { allowlistedCommand, validateShellArg } from '$lib/server/policy';
import { validationError, approvalRequiredError } from '$lib/server/errors/types';
import type { RequestEvent } from '$lib/server/types';

const ExecInput = z.object({
  op: z.string().min(1).max(64),
  args: z.record(z.string(), z.unknown()).default({}),
});

function nameFromParams(event: RequestEvent): string {
  return (event.params as { name: string }).name;
}

export const POST = defineRoute({
  methods: ['POST'],
  input: ExecInput,
  auth: 'admin',
  surface: 'incus',
  action: 'incus.exec_named',
  target: (i) => `incus:${i.op}`,
  rateLimit: { limit: 10, windowSec: 60, bucket: 'user' },
  handler: async ({ event, input }) => {
    // Allowlist: only `incus.exec-named` and the `term.*` ops are
    // dispatchable through this endpoint.
    const entry = allowlistedCommand('incus.exec-named');
    if (!entry) {
      throw validationError('incus.exec-named not allowlisted', []);
    }

    // Validate the inner op against the same allowlist.
    const inner = allowlistedCommand(input.op);
    if (!inner) {
      throw validationError(`Unsupported incus op: ${input.op}`, [
        { field: 'op', message: 'unknown' },
      ]);
    }

    // Arg validation (T-104 / SR-100 schema tier).
    const argErrors: { field: string; message: string }[] = [];
    for (const [k, v] of Object.entries(input.args)) {
      if (typeof v === 'string') {
        const r = validateShellArg(v);
        if (!r.ok) {
          argErrors.push({ field: `args.${k}`, message: `${r.reason} (matched: ${r.matched})` });
        }
      }
    }
    if (argErrors.length > 0) {
      throw validationError('Arg validation failed', argErrors);
    }

    if (inner.requiresApproval) {
      throw approvalRequiredError(`incus.${input.op}:${nameFromParams(event)}`, 60);
    }

    return {
      instance: nameFromParams(event),
      op: input.op,
      argv: entry.argv,
      status: 'accepted',
      message: 'M1 stub: incus exec dispatch lands in M3',
    };
  },
});
