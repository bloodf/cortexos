/**
 * /api/terminal — admin-only allowlisted terminal operations.
 *
 * PB-2 FIX (THREAT_MODEL §1.2 surface 3, T-020, T-021, T-022, T-023):
 * The previous implementation accepted arbitrary `bash -c <userstring>`.
 * M1 accepted ONLY allowlisted operations; anything else is rejected
 * with 400 + audit row. M2 routes the request through the PTY bridge
 * (`$lib/server/terminal/pty-bridge`) which adds a second-line
 * allowlist + arg-smuggling + argv-rendering guard, then dispatches.
 *
 * Endpoints:
 *   - POST /api/terminal { op: 'term.ps' | 'term.df' | ..., args: {...} }
 *   - GET  /api/terminal/ops  (via +server.ts GET) — list allowlisted
 *     terminal ops for the UI; admin-only.
 *
 * PB-2 guarantee: a body like `{ op: 'bash -c id' }` is rejected with 400
 * before any dispatch. This is unit-tested in `__tests__/terminal.test.ts`
 * and integration-tested in `routes.test.ts`.
 */
import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { allowlistedCommand, validateShellArg } from '$lib/server/policy';
import { approvalRequiredError, validationError } from '$lib/server/errors/types';
import { dispatch, listTerminalOps } from '$lib/server/terminal/pty-bridge';

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

/** POST — dispatch a terminal op. */
export const POST = defineRoute({
  methods: ['POST'],
  input: TerminalInput,
  auth: 'admin',
  surface: 'terminal',
  action: 'terminal.exec',
  target: (i) => i.op,
  rateLimit: { limit: 10, windowSec: 60, bucket: 'user' },
  handler: async ({ input, user, event }) => {
    // 1. Allowlist check at the route boundary (defence in depth).
    const entry = allowlistedCommand(input.op);
    if (!entry) {
      // No `bash -c` from the UI — reject any unknown op with 400.
      throw validationError(`Unsupported terminal op: ${input.op}`, [
        { field: 'op', message: 'unknown' },
      ]);
    }

    // 2. Arg validation (T-104 / SR-100 schema tier).
    const argErrors: { field: string; message: string }[] = [];
    validateAllArgs(input.args ?? {}, argErrors);
    if (argErrors.length > 0) {
      throw validationError('Arg validation failed', argErrors);
    }

    // 3. Run through the PTY bridge (second-line allowlist + arg scan +
    //    argv render + approval gate + dispatch). The bridge never
    //    throws; it returns a structured result. We translate it.
    const ip = event.getClientAddress();
    const ua = event.request.headers.get('user-agent');
    const result = await dispatch(
      { op: input.op, args: input.args ?? {} },
      {
        user,
        ip,
        userAgent: ua,
        requestId: event.request.headers.get('x-request-id') ?? '',
      },
    );

    if (result.status === 'rejected') {
      throw validationError(result.reason, [
        { field: result.field ?? 'op', message: result.code },
      ]);
    }
    if (result.status === 'approval_required') {
      throw approvalRequiredError(result.actionHash, result.ttlSec);
    }

    // status === 'accepted'
    return {
      op: result.op,
      argv: result.argv,
      status: 'accepted',
      output: null,
      durationMs: result.durationMs,
      message: 'M2 stub: command would be dispatched via executeRootCommand in M3',
    };
  },
});

/** GET — list the allowlisted terminal ops the UI can offer. */
export const GET = defineRoute({
  methods: ['GET'],
  auth: 'admin',
  surface: 'terminal',
  action: 'terminal.list_ops',
  rateLimit: { limit: 30, windowSec: 60, bucket: 'user' },
  handler: async () => {
    const ops = listTerminalOps();
    return { ops };
  },
});
