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
 * Calls `dispatch` in `$lib/server/docker/bridge.ts`, which on a
 * Linux host actually shells out to the `docker` CLI via `execFile`
 * (no shell, no string interpolation). On macOS dev / unit tests
 * the bridge falls back to the M1 stub.
 */

import { z } from 'zod';
import { defineRoute } from '$lib/server/route-helper';
import { allowlistedCommand, validateShellArg } from '$lib/server/policy';
import { validationError, approvalRequiredError } from '$lib/server/errors/types';
import { dispatch as dispatchDocker } from '$lib/server/docker/bridge';
import { mintApproval } from '$lib/server/approval';

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
  handler: async ({ input, user, event }) => {
    const ip = event.getClientAddress();
    const userAgent = event.request.headers.get('user-agent');
    const requestId = (event.locals as { requestId?: string }).requestId ?? '';
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

    // 3. Approval gate for destructive / privileged. PB-5: every
    //    destructive / privileged op requires a token; without one
    //    the bridge returns 403 with confirmation headers.
    if (entry.requiresApproval) {
      throw approvalRequiredError(`docker.${input.action}:${input.container ?? ''}`, 60);
    }

    // 4. Hand off to the bridge. The bridge re-validates the op,
    //    runs the closed-allowlist argv through the executor, and
    //    returns the result. On Linux the executor shells out to
    //    `docker` via execFile; on macOS / unit tests it returns
    //    the M1 stub.
    //
    // The bridge's PB-5 gate demands an approval token for every op.
    // For non-destructive ops we self-mint a token from the caller's
    // own session — the gate stays in the code path (so the bridge
    // is provably enforcing PB-5 end-to-end) but the API surface
    // doesn't require a separate mint round-trip. Destructive ops
    // throw `approvalRequiredError` above before this line is reached.
    const sessionId = (event.locals as { session?: { id?: string } }).session?.id;
    const dispatchArgs = { ...(input.container ? { container: input.container } : {}) };
    const approvalToken = mintApproval({
      action: opName,
      payload: { op: opName, args: dispatchArgs },
      sessionId: (sessionId ?? 'api') as never,
      userId: String(user.id),
      ttlSec: 60,
    }).token;

    const result = await dispatchDocker(
      {
        op: opName,
        args: dispatchArgs,
        approvalToken,
        sessionId: sessionId ?? null,
      },
      {
        user,
        ip,
        userAgent: userAgent ?? null,
        requestId,
      },
    );

    if (result.status === 'rejected') {
      // Throw the validation error so defineRoute's error handler
      // returns the right JSON shape. Returning jsonError() directly
      // would JSON.stringify to `{}` (a Response has no own
      // enumerable props).
      throw validationError(result.reason, [
        ...(result.field ? [{ field: result.field, message: result.reason }] : []),
        { field: 'op', message: result.code },
      ]);
    }
    // The bridge's `accepted` shape wraps the executor's output in
    // `output: { stdout, stderr, exitCode }` (plus the rendered argv
    // and a durationMs). Pull from there.
    const out = result.output as { stdout?: string; stderr?: string; exitCode?: number };

    return {
      action: input.action,
      container: input.container ?? null,
      status: 'accepted' as const,
      op: result.op,
      argv: result.argv,
      stdout: out.stdout ?? '',
      stderr: out.stderr ?? '',
      exitCode: out.exitCode ?? 0,
    };
  },
});
