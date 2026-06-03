/**
 * /api/terminal — admin-only allowlisted terminal operations.
 *
 * PB-2 FIX (THREAT_MODEL §1.2 surface 3, T-020, T-021, T-022, T-023):
 * The previous implementation accepted arbitrary `bash -c <userstring>`.
 * M1 accepts ONLY allowlisted operations; anything else is rejected
 * with 400 + audit row.
 *
 * M1 endpoints:
 *   - POST /api/terminal { op: 'term.ps' | 'term.df' | 'term.read_file', args: {...} }
 *
 * Each op maps to a fixed argv. The `args` are validated against the
 * op's argument schema (including shell-metacharacter denylist per T-104).
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { allowlistedCommand, validateShellArg, hasSmugglingPattern } from '$lib/server/policy';
import { approvalRequiredError, validationError } from '$lib/server/errors/types';

const TerminalInput = z.object({
  op: z.string().min(1).max(64),
  args: z.record(z.string(), z.unknown()).default({}),
});

function validateAllArgs(args: Record<string, unknown>, errors: { field: string; message: string }[]): void {
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string') {
      const r = validateShellArg(v);
      if (!r.ok) {
        errors.push({ field: `args.${k}`, message: `${r.reason} (matched: ${r.matched})` });
      }
    } else if (typeof v === 'object' && v !== null) {
      validateAllArgs(v as Record<string, unknown>, errors);
    }
  }
}

export const POST = defineRoute({
  methods: ['POST'],
  input: TerminalInput,
  auth: 'admin',
  surface: 'terminal',
  action: 'terminal.exec',
  target: (i) => i.op,
  rateLimit: { limit: 10, windowSec: 60, bucket: 'user' },
  handler: async ({ input }) => {
    // 1. Allowlist check.
    const entry = allowlistedCommand(input.op);
    if (!entry) {
      // No `bash -c` from the UI — reject any unknown op with 400.
      throw validationError(`Unsupported terminal op: ${input.op}`, [
        { field: 'op', message: 'unknown' },
      ]);
    }

    // 2. Arg validation (T-104 / SR-100 schema tier).
    const argErrors: { field: string; message: string }[] = [];
    validateAllArgs(input.args, argErrors);
    if (argErrors.length > 0) {
      throw validationError('Arg validation failed', argErrors);
    }

    // 3. Approval gate for destructive ops.
    if (entry.requiresApproval) {
      // The real route would call verifyApproval here. M1 stub throws
      // approval_required.
      throw approvalRequiredError(`terminal.${input.op}`, 60);
    }

    // 4. M3: dispatch via executeRootCommand. M1 returns a stub.
    return {
      op: input.op,
      argv: entry.argv,
      status: 'accepted',
      output: null,
      message: 'M1 stub: command would be dispatched via executeRootCommand in M3',
    };
  },
});

// Exposed for tests to inject shell-metacharacter values without going
// through the schema (which would reject unknown ops anyway).
// (re-exports removed; consumers import directly from $lib/server/policy)
