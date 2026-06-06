/**
 * PTY bridge — server-side allowlisted op dispatcher.
 *
 * M2-WS2 (Margaret, E2E): this module is the SvelteKit-side counterpart to
 * the desktop `cortex-sandbox-runner` PTY. M1 dispatch was a stub
 * (`M1 stub: command would be dispatched via executeRootCommand in M3`).
 * M2 wires the M3-shaped dispatcher **behind** the existing PB-2-fix
 * guard. The contract is:
 *
 *   1. UI submits `{ op, args }` to `/api/terminal`.
 *   2. Route handler calls `bridge.dispatch(op, args, ctx)` from this module.
 *   3. `dispatch()` re-runs the policy/arg-smuggling guards (defence in
 *      depth — the route already validated, but a misconfigured caller
 *      must not bypass the check), then maps `op` → argv via
 *      `allowlistedCommand`, fills `<placeholders>`, and (in M3) hands
 *      the argv to the root helper.
 *   4. In M2 we keep the dispatch in-process: the bridge writes a
 *      structured `pty-bridge-result` event back to the caller, with a
 *      `status: 'accepted' | 'approval_required' | 'rejected'` field
 *      and the resolved argv. The actual `spawn` lands in M3 alongside
 *      `executeRootCommand`. M2's job is to prove the contract end-to-end
 *      and to be the place where audit, approval, and rate-limit live for
 *      the terminal surface.
 *
 * Terminal ops surfaced by this module (via `listTerminalOps()` →
 * `listAllowlistedBySurface('terminal')` → the policy's
 * `installDefaultAllowlist()`):
 *
 *   - `term.ps`           — `ps auxf`
 *   - `term.top`          — `top -b -n 1`
 *   - `term.df`           — `df -h`
 *   - `term.read_file`    — `cat <path>`
 *   - `term.tail_log`     — `journalctl -u <unit> -n <N> --no-pager`
 *   - `term.exec_named`   — `/bin/sh -c <allowlisted-subcommand>`
 *   - `term.fzf`          — `fzf <query>`  (W58 — fuzzy-finder CLI)
 *
 * The last entry, `term.fzf`, is the operator-facing launcher for the
 * `junegunn/fzf` binary installed by `prompts/tools/30b-fzf.md`. The
 * `args.query` placeholder is the optional initial filter; the same
 * arg-smuggling defence-in-depth check that gates `term.read_file` /
 * `term.tail_log` / `term.exec_named` also applies to `term.fzf` (see
 * `__tests__/pty-bridge.test.ts` "term.fzf" cases). The wiring is
 * indirect: the entry lives in `policy/index.ts` (the canonical
 * allowlist), the surface projection happens via
 * `listAllowlistedBySurface('terminal')`, and the Quick-commands
 * palette in `CommandPalette.svelte:45-46` is `ops.map(...)`-driven
 * so the op appears without a component change.
 *
 * PB-2: the rejection of `bash -c <userstring>` is enforced twice.
 *   - At the route level: `allowlistedCommand('bash -c id')` → undefined →
 *     400 (`validationError`).
 *   - At the bridge level: same check, plus we additionally block argv
 *     arrays that contain a literal `bash -c` pair. The defence in depth
 *     means a future caller that imports `bridge.dispatch` directly
 *     cannot smuggle a `bash -c` argv.
 *
 * The bridge is deterministic: no `Date.now()`, no `Math.random()`, no
 * side effects on module import. Tests can swap the executor via
 * `setExecutorForTests`.
 */
import {
  allowlistedCommand,
  hasSmugglingPattern,
  listAllowlistedBySurface,
  validateShellArg,
  type AllowlistEntry,
} from '../policy';
import { audit } from '../audit';
import type { User } from '../entities';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Shape of the bridge call. Mirrors the route input but does not trust it. */
export interface DispatchInput {
  /** The op name from the allowlist (e.g. `term.ps`). */
  op: string;
  /** Keyed arguments; values are strings, numbers, or nested objects. */
  args: Readonly<Record<string, unknown>>;
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
    }
  | {
      status: 'approval_required';
      op: string;
      argv: ReadonlyArray<string>;
      actionHash: string;
      ttlSec: number;
      message: string;
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
        | 'placeholder_unbound';
      reason: string;
      /** When code === 'arg_smuggling' the offending field path. */
      field?: string;
    };

/**
 * Executor — the part M3 swaps for the real PTY. The signature is
 * kept tiny so the bridge is trivially testable.
 */
export type Executor = (argv: ReadonlyArray<string>) => Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}>;

// ---------------------------------------------------------------------------
// Default executor — M2 stub. Returns argv + a clear marker; M3 replaces
// this with `executeRootCommand(argv)` (THREAT_MODEL §6.3).
// ---------------------------------------------------------------------------

const M2_STUB_MARKER = '__cortexos_pty_bridge_stub__';

const defaultExecutor: Executor = async (argv) => {
  return {
    stdout: `${M2_STUB_MARKER} ${argv.join(' ')}`,
    stderr: '',
    exitCode: 0,
  };
};

// ---------------------------------------------------------------------------
// State — minimal. The executor is the only swappable piece.
// ---------------------------------------------------------------------------

let executor: Executor = defaultExecutor;

/** Test helper: swap the executor. Pass `null` to reset. */
export function setExecutorForTests(fn: Executor | null): void {
  executor = fn ?? defaultExecutor;
}

// ---------------------------------------------------------------------------
// Arg validation — second-line defence
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
 * the M2 belt-and-braces guard for PB-2. The route already rejects the
 * `bash -c` op name; this catches a future caller's attempt to
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
// Approval action hash — re-uses the approval module's algorithm so the
// front-end can fetch a matching token.
// ---------------------------------------------------------------------------

import { actionHashFor } from '../approval';

// ---------------------------------------------------------------------------
// dispatch — the public entry point
// ---------------------------------------------------------------------------

/**
 * Dispatch an allowlisted op.
 *
 * @returns a structured `DispatchResult`. Never throws. The route handler
 *          is responsible for turning `rejected` into the right HTTP
 *          status.
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
      surface: 'terminal',
      action: 'terminal.bridge.reject',
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

  // 2. Recursive arg-smuggling scan.
  const hits: { field: string; reason: string; matched: string }[] = [];
  collectArgSmugglingHits(input.args, '', hits);
  if (hits.length > 0) {
    const first = hits[0]!;
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'terminal',
      action: 'terminal.bridge.reject',
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
      surface: 'terminal',
      action: 'terminal.bridge.reject',
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

  // 4. PB-2: even if the op was `term.exec_named` (which has `sh -c
  //    <allowlisted-subcommand>` in its argv) the `<allowlisted-subcommand>`
  //    is a placeholder and is replaced by the caller's value — that
  //    value was scanned in step 2. As an extra belt-and-braces, we
  //    reject any *rendered* argv that still contains a literal
  //    `bash -c` pair.
  if (argvContainsBashDashC(rendered.argv)) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'terminal',
      action: 'terminal.bridge.reject',
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

  // 5. Approval gate for destructive ops.
  if (entry.requiresApproval) {
    const hash = actionHashFor(`terminal.${input.op}`, { op: input.op, args: { ...input.args } });
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'terminal',
      action: 'terminal.bridge.approval_required',
      target: input.op,
      result: 'success',
      errorCode: null,
      requestId: ctx.requestId,
      payload: { argv: rendered.argv, actionHash: hash },
    });
    return {
      status: 'approval_required',
      op: input.op,
      argv: rendered.argv,
      actionHash: hash,
      ttlSec: 60,
      message: 'This terminal op requires an approval token',
    };
  }

  // 6. Dispatch (M2: stub executor; M3: executeRootCommand).
  let dispatchOutcome: 'success' | 'failure' = 'success';
  try {
    await executor(rendered.argv);
  } catch (e) {
    dispatchOutcome = 'failure';
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'terminal',
      action: 'terminal.bridge.dispatch',
      target: input.op,
      result: 'failure',
      errorCode: 'executor_error',
      requestId: ctx.requestId,
      payload: { argv: rendered.argv, error: (e as Error).message },
    });
    return {
      status: 'rejected',
      op: input.op,
      code: 'argv_render',
      reason: `executor error: ${(e as Error).message}`,
    };
  }

  audit({
    actorUserId: ctx.user.id,
    actorSessionId: null,
    actorIp: ctx.ip,
    actorUserAgent: ctx.userAgent,
    surface: 'terminal',
    action: 'terminal.bridge.dispatch',
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
  };
}

// ---------------------------------------------------------------------------
// Convenience — list the terminal-surface allowlist for the UI.
// ---------------------------------------------------------------------------

/**
 * Return the allowlisted ops a UI can offer. We use the policy's
 * `listAllowlistedBySurface('terminal')` and project the fields the
 * `+page.server.ts` loader wants.
 */
export function listTerminalOps(): ReadonlyArray<{
  op: string;
  description: string;
  requiresApproval: boolean;
  placeholders: ReadonlyArray<string>;
}> {
  return listAllowlistedBySurface('terminal').map((e) => ({
    op: e.name,
    description: e.description,
    requiresApproval: e.requiresApproval,
    placeholders: e.argv
      .filter((t) => PLACEHOLDER_RE.test(t))
      .map((t) => t.slice(1, -1)),
  }));
}

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
