/**
 * Docker executor — the M2 swappable boundary over the real docker
 * socket.
 *
 * The M2 wave follows the same pattern as `terminal/pty-bridge.ts`:
 *
 *   1. The UI submits an allowlisted op (`docker.start` / `docker.stop`
 *      / `docker.restart` / `docker.rm` / `docker.logs` / `docker.exec`)
 *      with typed args to `/api/docker`.
 *   2. The route handler calls `dockerBridge.dispatch(op, args, ctx)`.
 *   3. `dispatch()` re-runs the PB-2 ban on `bash -c <userstring>`,
 *      re-runs the PB-5 admin+approval gate, then maps the op to
 *      a fixed argv via the policy allowlist, and (in M3) hands the
 *      argv to `executeRootCommand` from `cortex-sandbox-runner`.
 *   4. In M2 we keep the dispatch in-process: the bridge writes a
 *      structured `dispatch-result` back to the caller. The actual
 *      socket call lands in M3 — this module is the place where
 *      audit, approval, rate-limit, and arg-validation live for
 *      the docker surface.
 *
 * M3 swap: replace `defaultExecutor` (the M2 stub) with the real
 * `executeRootCommand` (THREAT_MODEL §6.3). The contract is
 * deliberately tiny — the bridge passes the rendered argv, the
 * executor runs it as root in the sandbox, and returns stdout/stderr/
 * exitCode. Tests can swap the executor via `setExecutorForTests`.
 *
 * PB-2 (SR-019) is enforced twice:
 *   - At the route level: `allowlistedCommand('bash -c id')` is undefined
 *     → 400. `bash -c <userstring>` never reaches the dispatch.
 *   - At the bridge level: the resolved argv is checked for a literal
 *     `bash -c` pair, AND the executor's argv renderer refuses to bind
 *     `<command>` to a value that contains shell metacharacters (T-104).
 *
 * PB-5 is enforced once: every op requires an approval token minted
 * by the calling user; `dispatch()` returns the action hash so the
 * caller can mint + pass the token.
 */
import {
  allowlistedCommand,
  hasSmugglingPattern,
  validateShellArg,
  listAllowlistedBySurface,
  type AllowlistEntry,
} from '../policy';
import { audit } from '../audit';
import type { User } from '../entities';
import { actionHashFor } from '../approval';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Shape of the bridge call. Mirrors the route input but does not trust it. */
export interface DispatchInput {
  /** The op name from the allowlist (e.g. `docker.start`). */
  op: string;
  /** Keyed arguments; values are strings, numbers, booleans, or nested objects. */
  args: Readonly<Record<string, unknown>>;
  /**
   * Approval token, when the op requires approval. The bridge
   * verifies + consumes it before dispatch. Required for every op —
   * PB-5 says even the "safe" ones (logs, inspect) get the gate in
   * M2 so the wiring is proven end-to-end.
   */
  approvalToken?: string | null;
  /** Caller's session id — for approval-token session binding. */
  sessionId?: string | null;
}

/** Caller context (who + where). The route provides this. */
export interface DispatchContext {
  user: User;
  ip: string;
  userAgent: string | null;
  requestId: string;
}

/** The structured result the bridge returns. */
export type DispatchResult =
  | {
      status: 'accepted';
      op: string;
      argv: ReadonlyArray<string>;
      durationMs: number;
      /** Marker returned by the M2 stub. M3 replaces with real stdout. */
      output: string;
    }
  | {
      status: 'rejected';
      op: string;
      code:
        | 'unknown_op'
        | 'arg_smuggling'
        | 'argv_bash_c'
        | 'arg_type'
        | 'argv_render'
        | 'placeholder_unbound'
        | 'missing_approval'
        | 'invalid_approval'
        | 'executor_error';
      reason: string;
      /** When code === 'arg_smuggling' the offending field path. */
      field?: string;
    };

/**
 * Executor — the part M3 swaps for the real docker socket (or
 * `executeRootCommand`). Signature is kept tiny so the bridge is
 * trivially testable.
 */
export type Executor = (argv: ReadonlyArray<string>) => Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}>;

// ---------------------------------------------------------------------------
// Default executor — real-host implementation. Shells out to the `docker`
// CLI with `execFile` (no shell, no string interpolation). The argv is
// already allowlisted by the bridge above (PB-2 / T-104), so this is
// the only piece that touches the real daemon.
//
// On macOS dev / Windows or in unit tests, the env var
// `CORTEX_DOCKER_BRIDGE_REAL=0` falls back to the M2 stub so the
// unit suite still runs. On a Linux host with docker installed, the
// real executor is the default.
// ---------------------------------------------------------------------------

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const M2_STUB_MARKER = '__cortexos_docker_bridge_stub__';

/** Real executor — `docker <argv...>` via execFile (no shell). */
const realDockerExecutor: Executor = async (argv) => {
  // The first element of argv is `docker`; the rest is the docker subcommand
  // + args. We split so `execFile` gets the program + args array.
  const [program, ...args] = argv;
  if (!program) {
    return { stdout: '', stderr: 'empty argv', exitCode: 2 };
  }
  try {
    const { stdout, stderr } = await execFileAsync(program, args, {
      // docker can be slow to talk to the daemon; give it a real timeout.
      timeout: 30_000,
      // Cap the captured output so a runaway container log can't OOM the
      // dashboard. Truncation is signaled via the exit code (124 = timeout,
      // we treat >4MB output the same way).
      maxBuffer: 4 * 1024 * 1024,
    });
    return { stdout: stdout ?? '', stderr: stderr ?? '', exitCode: 0 };
  } catch (err) {
    const e = err as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? e.message ?? 'docker exec failed',
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
};

const defaultExecutor: Executor =
  process.env.CORTEX_DOCKER_BRIDGE_REAL === '0' ||
  process.platform === 'win32' ||
  (process.platform === 'darwin' && process.env.CORTEX_DOCKER_BRIDGE_REAL !== '1')
    ? async (argv) => ({
        stdout: `${M2_STUB_MARKER} ${argv.join(' ')}`,
        stderr: '',
        exitCode: 0,
      })
    : realDockerExecutor;

// ---------------------------------------------------------------------------
// State — minimal. The executor is the only swappable piece.
// ---------------------------------------------------------------------------

let executor: Executor = defaultExecutor;

/** Test helper: swap the executor. Pass `null` to reset. */
export function setExecutorForTests(fn: Executor | null): void {
  executor = fn ?? defaultExecutor;
}

// ---------------------------------------------------------------------------
// Arg validation — second-line defence (PB-2 / T-104)
// ---------------------------------------------------------------------------

/** Recursively walk an args object and return a flat list of violations. */
function collectArgSmugglingHits(
  value: unknown,
  path: string,
  hits: { field: string; reason: string; matched: string }[],
): void {
  if (typeof value === 'string') {
    const r = validateShellArg(value);
    if (!r.ok) hits.push({ field: path, reason: r.reason, matched: r.matched });
    return;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return;
  }
  if (value === null) return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectArgSmugglingHits(value[i], `${path}[${i}]`, hits);
    }
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      collectArgSmugglingHits(v, path ? `${path}.${k}` : k, hits);
    }
  }
}

/**
 * True if the resolved argv contains a literal `bash -c` pair. This is
 * the M2 belt-and-braces guard for PB-2 / SR-019. The route already
 * rejects the op; this catches a future caller's attempt to
 * pre-construct an argv (e.g. from a config table) and run it through
 * the bridge.
 */
function argvContainsBashDashC(argv: ReadonlyArray<string>): boolean {
  for (let i = 0; i < argv.length - 1; i++) {
    const a = argv[i]!;
    const b = argv[i + 1]!;
    // Match `/bin/bash`, `bash`, `sh`, `zsh`, `ksh` followed by `-c`.
    if (
      /(^|\/)(bash|sh|zsh|ksh)$/.test(a) &&
      b === '-c'
    ) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Argv rendering — fill `<placeholder>` tokens with the corresponding arg.
// ---------------------------------------------------------------------------

const PLACEHOLDER_RE = /^<[a-zA-Z_][a-zA-Z0-9_]*>$/;

/**
 * Render an argv from an `AllowlistEntry` + the caller's `args` object.
 * Returns `null` if a placeholder cannot be bound. Allowed binding
 * sources:
 *   - top-level keys in `args`
 *   - values must be string or number
 * Numbers are stringified with a strict base-10 conversion. Booleans and
 * other types are rejected (`arg_type`).
 */
function renderArgv(
  entry: AllowlistEntry,
  args: Readonly<Record<string, unknown>>,
): { argv: string[] } | { code: 'placeholder_unbound' | 'arg_type'; field: string; reason: string } {
  const argv: string[] = [];
  for (const token of entry.argv) {
    if (PLACEHOLDER_RE.test(token)) {
      const key = token.slice(1, -1);
      const v = args[key];
      if (v === undefined || v === null) {
        return { code: 'placeholder_unbound', field: key, reason: `placeholder <${key}> not provided` };
      }
      if (typeof v === 'string') {
        argv.push(v);
      } else if (typeof v === 'number' && Number.isFinite(v)) {
        argv.push(String(v));
      } else {
        return { code: 'arg_type', field: key, reason: `placeholder <${key}> must be string|number` };
      }
    } else {
      argv.push(token);
    }
  }
  return { argv };
}

// ---------------------------------------------------------------------------
// dispatch — the public entry point
// ---------------------------------------------------------------------------

/**
 * Dispatch an allowlisted docker op.
 *
 * PB-5: every op requires a valid approval token. The route mints the
 *       token via the approval module's `mintApproval` (which uses
 *       `actionHashFor` from this bridge's perspective); the bridge
 *       verifies the same hash and consumes the token.
 *
 * PB-2: `bash -c <userstring>` is rejected at two layers — the route
 *       checks the op name against the allowlist (so `bash -c id` as
 *       an op is 400); the bridge additionally scans the resolved
 *       argv for a literal `bash -c` pair AND scans the args object
 *       for shell metacharacters (T-104).
 *
 * @returns a structured `DispatchResult`. Never throws. The route
 *          handler is responsible for turning `rejected` into the
 *          right HTTP status.
 */
export async function dispatch(
  input: DispatchInput,
  ctx: DispatchContext,
): Promise<DispatchResult> {
  const t0 = Date.now();

  // 1. Op must be on the allowlist (route also checks — defence in depth).
  const entry = allowlistedCommand(input.op);
  if (!entry) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'docker',
      action: 'docker.bridge.reject',
      target: input.op,
      result: 'failure',
      errorCode: 'unknown_op',
      requestId: ctx.requestId,
      payload: { phase: 'allowlist', op: input.op },
    });
    return {
      status: 'rejected',
      op: input.op,
      code: 'unknown_op',
      reason: `op '${input.op}' is not on the allowlist`,
    };
  }

  // 2. Recursive arg-smuggling scan (PB-2 / T-104).
  const hits: { field: string; reason: string; matched: string }[] = [];
  collectArgSmugglingHits(input.args, '', hits);
  if (hits.length > 0) {
    const first = hits[0]!;
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'docker',
      action: 'docker.bridge.reject',
      target: input.op,
      result: 'denied',
      errorCode: 'arg_smuggling',
      requestId: ctx.requestId,
      payload: { phase: 'arg_smuggling', hits },
    });
    return {
      status: 'rejected',
      op: input.op,
      code: 'arg_smuggling',
      reason: first.reason,
      field: first.field || '_root',
    };
  }

  // 3. Render the argv from the entry's placeholders.
  const rendered = renderArgv(entry, input.args);
  if ('code' in rendered) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'docker',
      action: 'docker.bridge.reject',
      target: input.op,
      result: 'failure',
      errorCode: rendered.code,
      requestId: ctx.requestId,
      payload: { phase: 'render', code: rendered.code, field: rendered.field },
    });
    return {
      status: 'rejected',
      op: input.op,
      code: rendered.code,
      reason: rendered.reason,
      field: rendered.field,
    };
  }

  // 4. PB-2 belt-and-braces: even if the op is on the allowlist,
  //    reject any rendered argv that still contains a literal
  //    `bash -c` pair. This catches a future caller that pre-
  //    constructs an argv from a config table.
  if (argvContainsBashDashC(rendered.argv)) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'docker',
      action: 'docker.bridge.reject',
      target: input.op,
      result: 'denied',
      errorCode: 'argv_bash_c',
      requestId: ctx.requestId,
      payload: { phase: 'argv_bash_c', argv: rendered.argv },
    });
    return {
      status: 'rejected',
      op: input.op,
      code: 'argv_bash_c',
      reason: 'rendered argv contains a literal `bash -c` pair',
    };
  }

  // 5. PB-5: every op requires an approval token. We verify the
  //    same action-hash the approval module mints (via actionHashFor).
  if (!input.approvalToken) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'docker',
      action: 'docker.bridge.reject',
      target: input.op,
      result: 'denied',
      errorCode: 'missing_approval',
      requestId: ctx.requestId,
      payload: { phase: 'approval', argv: rendered.argv },
    });
    return {
      status: 'rejected',
      op: input.op,
      code: 'missing_approval',
      reason: 'approval token is required for every docker op (PB-5)',
    };
  }

  // Compute the canonical action hash so the caller and the bridge
  // agree on what the token is bound to.
  // The action string is the op itself (e.g. `docker.start`); the
  // payload encodes the op + args so a token bound to a different
  // op or different args is rejected.
  const expectedActionHash = actionHashFor(input.op, {
    op: input.op,
    args: { ...input.args },
  });

  // Lazy-import the approval verify to avoid a circular import at
  // module load (the approval module pulls in the HMAC key which
  // pulls in config).
  const { verifyApproval, consumeApproval } = await import('../approval');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionId = (input.sessionId ?? '') as any;
  const verify = verifyApproval(input.approvalToken, sessionId);
  if (!verify.ok) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'docker',
      action: 'docker.bridge.reject',
      target: input.op,
      result: 'denied',
      errorCode: 'invalid_approval',
      requestId: ctx.requestId,
      payload: { phase: 'approval', reason: verify.reason, expectedActionHash },
    });
    return {
      status: 'rejected',
      op: input.op,
      code: 'invalid_approval',
      reason: `approval token rejected: ${verify.reason}`,
    };
  }
  // Action hash check — the token must be bound to this specific op+args.
  if (verify.claims.actionHash !== expectedActionHash) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'docker',
      action: 'docker.bridge.reject',
      target: input.op,
      result: 'denied',
      errorCode: 'invalid_approval',
      requestId: ctx.requestId,
      payload: { phase: 'approval', reason: 'action_hash_mismatch', expectedActionHash, actual: verify.claims.actionHash },
    });
    return {
      status: 'rejected',
      op: input.op,
      code: 'invalid_approval',
      reason: 'approval token action-hash mismatch (PB-5: token bound to a different op or args)',
    };
  }

  // Consume the token so it cannot be reused.
  const consumed = consumeApproval(input.approvalToken, sessionId);
  if (!consumed.ok) {
    return {
      status: 'rejected',
      op: input.op,
      code: 'invalid_approval',
      reason: `approval token rejected on consume: ${consumed.reason}`,
    };
  }

  // 6. Dispatch (M2: stub executor; M3: executeRootCommand).
  let dispatchOutcome: 'success' | 'failure' = 'success';
  let output = '';
  try {
    const result = await executor(rendered.argv);
    output = result.stdout;
    if (result.exitCode !== 0) {
      dispatchOutcome = 'failure';
    }
  } catch (e) {
    dispatchOutcome = 'failure';
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'docker',
      action: 'docker.bridge.dispatch',
      target: input.op,
      result: 'failure',
      errorCode: 'executor_error',
      requestId: ctx.requestId,
      payload: { argv: rendered.argv, error: (e as Error).message },
    });
    return {
      status: 'rejected',
      op: input.op,
      code: 'executor_error',
      reason: `executor error: ${(e as Error).message}`,
    };
  }

  audit({
    actorUserId: ctx.user.id,
    actorSessionId: null,
    actorIp: ctx.ip,
    actorUserAgent: ctx.userAgent,
    surface: 'docker',
    action: 'docker.bridge.dispatch',
    target: input.op,
    result: dispatchOutcome,
    errorCode: null,
    requestId: ctx.requestId,
    payload: { argv: rendered.argv },
  });

  return {
    status: 'accepted',
    op: input.op,
    argv: rendered.argv,
    durationMs: Date.now() - t0,
    output,
  };
}

// ---------------------------------------------------------------------------
// Convenience — list the docker-surface allowlist for the UI.
// ---------------------------------------------------------------------------

/**
 * Return the allowlisted ops a UI can offer. We use the policy's
 * `listAllowlistedBySurface('docker')` and project the fields the
 * `+server.ts` loader wants.
 */
export function listDockerOps(): ReadonlyArray<{
  op: string;
  description: string;
  requiresApproval: boolean;
  placeholders: ReadonlyArray<string>;
}> {
  return listAllowlistedBySurface('docker').map((e) => ({
    op: e.name,
    description: e.description,
    requiresApproval: e.requiresApproval,
    placeholders: e.argv
      .filter((t) => PLACEHOLDER_RE.test(t))
      .map((t) => t.slice(1, -1)),
  }));
}

// Re-export the policy helper for the test surface.
export { hasSmugglingPattern };

// ---------------------------------------------------------------------------
// Internal — surfaces for tests
// ---------------------------------------------------------------------------

/** Test helper: peek at the default-stub marker. */
export const _STUB_MARKER = M2_STUB_MARKER;

/** Test helper: re-export for the unit test. */
export const _internals = {
  collectArgSmugglingHits,
  argvContainsBashDashC,
  renderArgv,
  hasSmugglingPattern,
};
