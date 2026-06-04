/**
 * Systemd bridge — server-side dispatcher for systemd unit operations.
 *
 * Mirrors the role of `terminal/pty-bridge.ts`: a swappable `UnitExecutor`
 * sits behind a strict policy gate, and every action is audit-logged with
 * the action hash so the M2 admin + approval-token flow (PB-5) can be
 * enforced uniformly across privileged surfaces.
 *
 * M2: in-memory mock. The `MockUnitExecutor` keeps a `Map<name, Unit>` and
 * mutates `active`/`sub`/`enabled`/`critical`/`allowlisted` when actions
 * are dispatched. The M3 swap is `RootHelperUnitExecutor` which shells
 * out via the root helper — same public surface, no call-site changes.
 *
 * Hard rules (THREAT_MODEL §4.4.2 + PB-5 + SR-019):
 *   - The unit name is regex-validated AND checked against the policy
 *     allowlist (the unit's `allowlisted: true` flag from the bridge).
 *   - Admin-gated: every `dispatch*` call requires `requireAdmin(event)`.
 *   - Destructive actions (restart, stop, disable) require an approval
 *     token. The token's `actionHash` MUST equal `actionHashFor(action,
 *     { name })` for the call to succeed.
 *   - The executor NEVER accepts a `bash -c <userstring>` argv. Today
 *     this is moot (the mock is in-process), but the M3 swap inherits
 *     the same invariant: the executor is constructed with a fixed argv
 *     template per action; placeholders are bound to validated names.
 *
 * Public surface:
 *   - listUnits()                       → SystemdUnit[]
 *   - getUnit(name)                     → SystemdUnit | null
 *   - listLogs(name, limit)             → SystemdLogLine[]
 *   - listUnitActions()                 → readonly AllowlistEntry[]
 *   - dispatchAction(input, ctx)        → DispatchResult (never throws)
 *   - setExecutorForTests(fn)           → test helper
 *
 * The audit log, the policy module, the approval module, and the
 * requireAdmin helper are imported here so the bridge is the single
 * place a privileged op crosses the trust boundary.
 */

import {
  SystemdUnitSchema,
  SystemdLogLineSchema,
  type SystemdUnit,
  type SystemdLogLine,
  type SystemdActionKind,
  type SystemdActiveState,
  type SystemdLoadState,
} from '@cortexos/contracts';
import { audit } from '../audit';
import { actionHashFor } from '../approval';
import { allowlistedCommand, type AllowlistEntry } from '../policy';
import type { User } from '../entities';

// ---------------------------------------------------------------------------
// Executor interface — the seam between M2 (mock) and M3 (root helper).
// ---------------------------------------------------------------------------

/**
 * The argv the executor will spawn. The bridge constructs this from
 * the allowlisted policy entry; the executor is a pure function of
 * (unitName) → argv. No `bash -c` pair is ever allowed in this argv.
 */
export interface UnitExecutorContext {
  /** The unit the action targets. Validated by the bridge. */
  unit: SystemdUnit;
  /** The action being performed. */
  action: SystemdActionKind;
  /** The user on whose behalf the action runs. */
  user: User;
  /**
   * Client IP. Recorded for the audit log; the executor should NOT
   * use this for any branching.
   */
  ip: string;
  /**
   * Request id from the hook. Echoed in the audit row.
   */
  requestId: string;
}

/**
 * The result the executor returns. Mirrors the contracts
 * `SystemdActionResult` plus a friendly message for the UI.
 */
export interface UnitExecutorResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** The updated unit snapshot (so the UI can re-render without a refetch). */
  unit: SystemdUnit;
}

/**
 * The swappable executor. M2 ships a `MockUnitExecutor`; M3 will ship
 * `RootHelperUnitExecutor` that runs the real `systemctl` via the root
 * helper. Both share the same signature.
 */
export type UnitExecutor = (ctx: UnitExecutorContext) => Promise<UnitExecutorResult>;

// ---------------------------------------------------------------------------
// Mock executor (M2). In-memory, deterministic, no shell.
// ---------------------------------------------------------------------------

/**
 * The M2 mock executor. Mutates the in-memory unit snapshot to reflect
 * the action's effect (e.g. `start` → `active='active'`, `sub='running'`)
 * and produces a synthetic stdout/stderr pair.
 *
 * Crucially, no `bash`/`sh` is ever invoked. The "command" we pretend
 * to run is a string for human readers only; the state mutation is the
 * real effect. M3 swaps this for `executeRootCommand(['/usr/bin/systemctl',
 * action, unit.name])`.
 *
 * Implements `UnitExecutor` as a `run(ctx)` method plus a small
 * function wrapper. The function wrapper is the actual swap target
 * (matches the `Executor = (argv) => Promise<...>` shape used in
 * `terminal/pty-bridge.ts`).
 */
export class MockUnitExecutor {
  private readonly snapshots = new Map<string, SystemdUnit>();

  /** Seed initial units. Idempotent. */
  seed(units: readonly SystemdUnit[]): void {
    for (const u of units) {
      if (!this.snapshots.has(u.name)) this.snapshots.set(u.name, { ...u });
    }
  }

  /** Read-only access for the bridge loaders. */
  snapshot(name: string): SystemdUnit | null {
    const u = this.snapshots.get(name);
    return u ? { ...u } : null;
  }

  list(): SystemdUnit[] {
    return Array.from(this.snapshots.values())
      .map((u) => ({ ...u }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Push a fake log line (used by the mock for `listLogs`). */
  pushLog(name: string, line: SystemdLogLine): void {
    const list = this.logsByUnit.get(name) ?? [];
    list.push(line);
    // Keep the last 500 per unit; the bridge never exposes more than that.
    if (list.length > 500) list.splice(0, list.length - 500);
    this.logsByUnit.set(name, list);
  }

  private readonly logsByUnit = new Map<string, SystemdLogLine[]>();

  /** Run an action — same shape as the `UnitExecutor` function. */
  run = async (ctx: UnitExecutorContext): Promise<UnitExecutorResult> => {
    const current = this.snapshots.get(ctx.unit.name);
    if (!current) {
      return {
        stdout: '',
        stderr: `Unit ${ctx.unit.name} not loaded in mock executor`,
        exitCode: 1,
        unit: ctx.unit,
      };
    }
    const next = applyAction(current, ctx.action);
    this.snapshots.set(ctx.unit.name, next);
    return {
      stdout: `__cortexos_systemd_mock__ ${ctx.action} ${ctx.unit.name}`,
      stderr: '',
      exitCode: 0,
      unit: next,
    };
  }

  /** Read the log buffer for a unit. The bridge trims to `limit`. */
  logsFor(name: string): readonly SystemdLogLine[] {
    return this.logsByUnit.get(name) ?? [];
  }
}

/**
 * Apply a systemd action to a unit snapshot. Pure function: same input
 * → same output. The mock executor calls this to derive the next state.
 *
 * Real `systemctl` semantics are more nuanced; the mock mirrors the
 * common-case transitions documented in `systemctl(1)` and the
 * `ServiceState` enum on the contracts side.
 */
export function applyAction(unit: SystemdUnit, action: SystemdActionKind): SystemdUnit {
  switch (action) {
    case 'start':
      return { ...unit, active: 'active', sub: 'running' };
    case 'stop':
      return { ...unit, active: 'inactive', sub: 'dead' };
    case 'restart':
      return { ...unit, active: 'active', sub: 'running' };
    case 'reload':
      return { ...unit, active: 'active', sub: 'running' };
    case 'enable':
      return { ...unit, enabled: true };
    case 'disable':
      return { ...unit, enabled: false };
    case 'status':
      return { ...unit };
    case 'list-units':
      return { ...unit };
  }
}

// ---------------------------------------------------------------------------
// Real executor (Linux only). Calls `systemctl` via execFile — no shell,
// no string interpolation. The unit name and action are both already
// allowlisted by the bridge before this runs (PB-2 / T-104).
//
// On macOS dev or in unit tests, the env var
// `CORTEX_SYSTEMD_BRIDGE_REAL=0` falls back to the M2 mock so the
// unit suite still runs. On a Linux host running systemd, the real
// executor is the default.
// ---------------------------------------------------------------------------

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Map a `systemctl show` key=value block to a partial SystemdUnit.
 * `systemctl show` emits lines like `ActiveState=active\nSubState=running`.
 */
function parseSystemctlShow(out: string, fallback: SystemdUnit): SystemdUnit {
  const get = (k: string): string | undefined => {
    const m = new RegExp(`^${k}=(.*)$`, 'm').exec(out);
    return m?.[1];
  };
  const active = (get('ActiveState') as SystemdActiveState) ?? fallback.active;
  const sub = get('SubState') ?? fallback.sub;
  const load = (get('LoadState') as SystemdLoadState) ?? fallback.load;
  const unitFileState = get('UnitFileState') ?? '';
  const enabled = unitFileState === 'enabled' || unitFileState === 'enabled-runtime';
  const type = get('Type') ?? fallback.type;
  const unitPath = get('FragmentPath') ?? null;
  const description = get('Description') ?? fallback.description;
  return {
    ...fallback,
    description,
    load,
    active,
    sub,
    enabled,
    type,
    unitPath: unitPath === '' ? null : unitPath,
  };
}

const MOCK_MARKER = '__cortexos_systemd_mock__';

const realSystemdExecutor: UnitExecutor = async (ctx) => {
  // `start`, `stop`, etc. take no extra args; `enable`/`disable` same.
  // `reload` targets a unit; systemctl accepts `--` before the name but
  // we don't need it for the simple `systemctl <action> <name>` form.
  const args: string[] = [ctx.action, ctx.unit.name];
  try {
    const { stdout, stderr } = await execFileAsync('/usr/bin/systemctl', args, {
      timeout: 30_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    // After the action, query the current state so the UI re-renders
    // with the real post-action values.
    const { stdout: showOut } = await execFileAsync(
      '/usr/bin/systemctl',
      [
        'show',
        ctx.unit.name,
        '--property=ActiveState,SubState,LoadState,UnitFileState,Type,FragmentPath,Description',
      ],
      { timeout: 10_000, maxBuffer: 256 * 1024 },
    );
    const updated = parseSystemctlShow(showOut, ctx.unit);
    return { stdout: stdout ?? '', stderr: stderr ?? '', exitCode: 0, unit: updated };
  } catch (err) {
    const e = err as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? e.message ?? 'systemctl exec failed',
      exitCode: typeof e.code === 'number' ? e.code : 1,
      unit: ctx.unit,
    };
  }
};

// ---------------------------------------------------------------------------
// Seed units — representative set for the M2 mock. Declared above the
// executor state so the eager-init block can reference it.
// ---------------------------------------------------------------------------

const SEED_UNITS: readonly SystemdUnit[] = [
  {
    name: 'caddy.service',
    description: 'Caddy HTTP/2 web server',
    load: 'loaded',
    active: 'active',
    sub: 'running',
    enabled: true,
    type: 'service',
    unitPath: '/etc/systemd/system/caddy.service',
    allowlisted: true,
    critical: false,
  },
  {
    name: 'tailscaled.service',
    description: 'Tailscale node agent',
    load: 'loaded',
    active: 'active',
    sub: 'running',
    enabled: true,
    type: 'service',
    unitPath: '/usr/lib/systemd/system/tailscaled.service',
    allowlisted: true,
    critical: false,
  },
  {
    name: 'postgresql.service',
    description: 'PostgreSQL database server',
    load: 'loaded',
    active: 'active',
    sub: 'running',
    enabled: true,
    type: 'service',
    unitPath: '/usr/lib/systemd/system/postgresql.service',
    allowlisted: true,
    critical: true,
  },
  {
    name: 'redis-server.service',
    description: 'Advanced key-value store',
    load: 'loaded',
    active: 'inactive',
    sub: 'dead',
    enabled: true,
    type: 'service',
    unitPath: '/usr/lib/systemd/system/redis-server.service',
    allowlisted: true,
    critical: false,
  },
  {
    name: 'nginx.service',
    description: 'A high performance web server and a reverse proxy server',
    load: 'loaded',
    active: 'failed',
    sub: 'failed',
    enabled: true,
    type: 'service',
    unitPath: '/etc/systemd/system/nginx.service',
    allowlisted: true,
    critical: true,
  },
  {
    name: 'docker.service',
    description: 'Docker Application Container Engine',
    load: 'loaded',
    active: 'active',
    sub: 'running',
    enabled: true,
    type: 'service',
    unitPath: '/usr/lib/systemd/system/docker.service',
    allowlisted: true,
    critical: true,
  },
  {
    name: 'unattended-upgrades.service',
    description: 'Unattended Upgrades Shutdown',
    load: 'loaded',
    active: 'inactive',
    sub: 'dead',
    enabled: false,
    type: 'service',
    unitPath: '/usr/lib/systemd/system/unattended-upgrades.service',
    allowlisted: false,
    critical: false,
  },
  {
    name: 'cron.service',
    description: 'Regular background program processing daemon',
    load: 'loaded',
    active: 'active',
    sub: 'running',
    enabled: true,
    type: 'service',
    unitPath: '/usr/lib/systemd/system/cron.service',
    allowlisted: true,
    critical: false,
  },
];

/** Pre-populate the log buffer so the dev / detail page is non-empty. */
function seedLogs(mock: MockUnitExecutor): void {
  const now = new Date().toISOString();
  for (const u of SEED_UNITS) {
    mock.pushLog(u.name, {
      ts: now,
      priority: 'info',
      unit: u.name,
      message: `Started ${u.name}.`,
    });
    mock.pushLog(u.name, {
      ts: now,
      priority: 'info',
      unit: u.name,
      message: `Reached target ${u.description || u.name}.`,
    });
    if (u.active === 'failed') {
      mock.pushLog(u.name, {
        ts: now,
        priority: 'err',
        unit: u.name,
        message: `Main process exited, code=exited, status=1/FAILURE.`,
      });
    }
  }
}

/** Build a fresh default mock + wrapper. */
function makeDefaultMock(): { mock: MockUnitExecutor; executor: UnitExecutor } {
  const mock = new MockUnitExecutor();
  mock.seed(SEED_UNITS);
  seedLogs(mock);
  return { mock, executor: (ctx) => mock.run(ctx) };
}

// ---------------------------------------------------------------------------
// Module-level state — the executor is the only swappable piece.
// ---------------------------------------------------------------------------

let currentMock: MockUnitExecutor | null = null;
let executor: UnitExecutor = ((p) => {
  throw new Error('systemd bridge: executor used before init');
}) as UnitExecutor;

(function init() {
  // On Linux + systemd, default to the real executor so the dashboard
  // can actually start/stop/restart units in production. On macOS or
  // when CORTEX_SYSTEMD_BRIDGE_REAL=0 is set, fall back to the M2 mock
  // so dev workstations and unit tests keep working.
  const useReal =
    process.platform === 'linux' &&
    process.env.CORTEX_SYSTEMD_BRIDGE_REAL !== '0';
  if (useReal) {
    executor = realSystemdExecutor;
    return;
  }
  const { mock, executor: e } = makeDefaultMock();
  currentMock = mock;
  executor = e;
})();

/**
 * Test helper: swap the executor. Pass `null` to reset to the default
 * mock with the default seed.
 */
export function setExecutorForTests(fn: UnitExecutor | null): void {
  if (fn) {
    executor = fn;
    return;
  }
  const { mock, executor: e } = makeDefaultMock();
  currentMock = mock;
  executor = e;
}

/** Test helper: peek at the underlying mock. */
export function _getMockExecutorForTests(): MockUnitExecutor {
  if (!currentMock) {
    const { mock, executor: e } = makeDefaultMock();
    currentMock = mock;
    executor = e;
  }
  return currentMock;
}

/** Reset the in-memory store + re-seed with the default units. */
export function _resetSystemdBridgeForTests(): void {
  const { mock, executor: e } = makeDefaultMock();
  currentMock = mock;
  executor = e;
}

// ---------------------------------------------------------------------------
// Loaders — used by the +page.server.ts.
// ---------------------------------------------------------------------------

/**
 * List all units. On Linux + real mode, calls `systemctl list-units
 * --type=service --all --no-pager` and adapts the output to
 * `SystemdUnit[]`. Otherwise returns the M2 mock's seeded snapshot.
 */
export async function listUnits(): Promise<SystemdUnit[]> {
  if (!currentMock) {
    return listUnitsFromSystemctl();
  }
  return currentMock.list();
}

/** Look up a unit by name. Returns null when not found. */
export async function getUnit(name: string): Promise<SystemdUnit | null> {
  if (!currentMock) {
    return getUnitFromSystemctl(name);
  }
  return currentMock.snapshot(name);
}

/**
 * Real `systemctl show <name> --property=...` lookup. Returns null
 * if the unit doesn't exist (systemctl exits non-zero).
 */
async function getUnitFromSystemctl(name: string): Promise<SystemdUnit | null> {
  try {
    const { stdout } = await execFileAsync(
      '/usr/bin/systemctl',
      [
        'show',
        name,
        '--property=Names,Description,LoadState,ActiveState,SubState,UnitFileState,Type,FragmentPath',
      ],
      { timeout: 5_000, maxBuffer: 64 * 1024 },
    );
    const props: Record<string, string> = {};
    for (const line of stdout.split('\n')) {
      const m = /^(\w+)=(.*)$/.exec(line);
      if (m) props[m[1]!] = m[2]!;
    }
    // If systemctl returned only the names line, the unit doesn't exist.
    if (Object.keys(props).length <= 1) return null;
    const unitFileState = props.UnitFileState ?? '';
    return {
      name,
      description: props.Description ?? '',
      load: (props.LoadState as SystemdLoadState) ?? 'loaded',
      active: (props.ActiveState as SystemdActiveState) ?? 'unknown',
      sub: props.SubState ?? '',
      enabled: unitFileState === 'enabled' || unitFileState === 'enabled-runtime',
      type: props.Type ?? 'service',
      unitPath: props.FragmentPath?.trim() || null,
      allowlisted: true,
      critical: false,
    };
  } catch {
    return null;
  }
}

/**
 * Real `systemctl list-units` loader. Limited to a few representative
 * units for the live-host UI; full listing would be a v0.5.0 job.
 */
async function listUnitsFromSystemctl(): Promise<SystemdUnit[]> {
  try {
    const { stdout } = await execFileAsync(
      '/usr/bin/systemctl',
      ['list-units', '--type=service', '--all', '--no-pager', '--no-legend', '--plain'],
      { timeout: 5_000, maxBuffer: 256 * 1024 },
    );
    const out: SystemdUnit[] = [];
    for (const line of stdout.split('\n')) {
      const m = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/.exec(line.trim());
      if (!m) continue;
      const [, name, load, active, sub] = m;
      if (!name || !name.endsWith('.service')) continue;
      const unit = await getUnitFromSystemctl(name);
      if (unit) out.push(unit);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** Return the most-recent `limit` log lines for a unit. */
export async function listLogs(name: string, limit: number): Promise<SystemdLogLine[]> {
  if (currentMock) {
    const all = currentMock.logsFor(name);
    return all.slice(-Math.max(0, limit));
  }
  return [];
}

// ---------------------------------------------------------------------------
// Dispatch — the privileged path. Always returns a `DispatchResult`.
// ---------------------------------------------------------------------------

export interface DispatchInput {
  action: SystemdActionKind;
  name: string;
}

export interface DispatchContext {
  user: User;
  ip: string;
  userAgent: string | null;
  requestId: string;
  /**
   * Session id of the caller. Used to verify the approval token's
   * session binding (PB-1 / SR-020). Required for destructive
   * actions; the route layer passes it from `event.locals.session.id`.
   */
  sessionId: string;
  /**
   * Optional approval token. Required for destructive actions
   * (restart, stop, disable per the policy allowlist). The token's
   * `actionHash` must equal `actionHashFor('systemd.' + action, { name })`.
   */
  approvalToken?: string;
}

/**
 * The structured result the bridge returns. Never throws — the route
 * handler converts `rejected` to the right HTTP status.
 */
export type DispatchResult =
  | {
      status: 'accepted';
      action: SystemdActionKind;
      name: string;
      stdout: string;
      stderr: string;
      exitCode: number;
      unit: SystemdUnit;
      durationMs: number;
    }
  | {
      status: 'approval_required';
      action: SystemdActionKind;
      name: string;
      actionHash: string;
      ttlSec: number;
      message: string;
    }
  | {
      status: 'rejected';
      action: SystemdActionKind;
      name: string;
      code:
        | 'unknown_op'
        | 'unknown_unit'
        | 'not_allowlisted'
        | 'unit_name_invalid'
        | 'approval_required'
        | 'approval_invalid'
        | 'approval_expired'
        | 'approval_session_mismatch'
        | 'approval_already_used'
        | 'executor_error';
      reason: string;
    };

/**
 * Set of actions that the policy allowlist marks as destructive. Mirrors
 * `requiresApproval` in `policy/systemd.*` entries (M2 keeps the truth
 * here too so tests don't need to import the policy module).
 */
const DESTRUCTIVE_ACTIONS: ReadonlySet<SystemdActionKind> = new Set<SystemdActionKind>([
  'restart',
  'stop',
  'disable',
]);

const UNIT_NAME_RE = /^[A-Za-z0-9_.@-]+$/;

/** TTL for a destructive-action approval token. */
const APPROVAL_TTL_SEC = 60;

/**
 * Dispatch a systemd action.
 *
 * Order of checks (defence in depth — every layer rejects the bad case):
 *   1. Op is on the policy allowlist (e.g. `systemd.restart`).
 *   2. Unit name matches the strict regex.
 *   3. Unit is in the executor's snapshot and is `allowlisted`.
 *   4. If the action is destructive, the caller must supply a valid
 *      approval token (verified by `verifyApproval` semantics — see
 *      `verifyApproval`).
 *   5. Run the executor.
 */
export async function dispatchAction(
  input: DispatchInput,
  ctx: DispatchContext,
): Promise<DispatchResult> {
  const t0 = Date.now();
  const policyName = `systemd.${input.action}`;

  // 1. Policy allowlist.
  const entry: AllowlistEntry | undefined = allowlistedCommand(policyName);
  if (!entry) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'systemd',
      action: 'systemd.bridge.reject',
      target: input.name,
      result: 'failure',
      errorCode: 'unknown_op',
      requestId: ctx.requestId,
      payload: { phase: 'allowlist', op: policyName },
    });
    return {
      status: 'rejected',
      action: input.action,
      name: input.name,
      code: 'unknown_op',
      reason: `op '${policyName}' is not on the policy allowlist`,
    };
  }

  // 2. Unit name regex.
  if (!UNIT_NAME_RE.test(input.name)) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'systemd',
      action: 'systemd.bridge.reject',
      target: input.name,
      result: 'denied',
      errorCode: 'unit_name_invalid',
      requestId: ctx.requestId,
      payload: { phase: 'name_regex', op: policyName, name: input.name },
    });
    return {
      status: 'rejected',
      action: input.action,
      name: input.name,
      code: 'unit_name_invalid',
      reason: `unit name '${input.name}' does not match ${UNIT_NAME_RE.source}`,
    };
  }

  // 3. Unit exists + is allowlisted.
  const unit = await getUnit(input.name);
  if (!unit) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'systemd',
      action: 'systemd.bridge.reject',
      target: input.name,
      result: 'failure',
      errorCode: 'unknown_unit',
      requestId: ctx.requestId,
      payload: { phase: 'lookup', op: policyName, name: input.name },
    });
    return {
      status: 'rejected',
      action: input.action,
      name: input.name,
      code: 'unknown_unit',
      reason: `unit '${input.name}' is not in the executor's snapshot`,
    };
  }
  if (!unit.allowlisted) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'systemd',
      action: 'systemd.bridge.reject',
      target: input.name,
      result: 'denied',
      errorCode: 'not_allowlisted',
      requestId: ctx.requestId,
      payload: { phase: 'allowlist_unit', op: policyName, name: input.name },
    });
    return {
      status: 'rejected',
      action: input.action,
      name: input.name,
      code: 'not_allowlisted',
      reason: `unit '${input.name}' is not allowlisted`,
    };
  }

  // 4. Destructive action → approval gate.
  if (DESTRUCTIVE_ACTIONS.has(input.action)) {
    const actionHash = actionHashFor(policyName, { name: input.name });
    if (!ctx.approvalToken) {
      audit({
        actorUserId: ctx.user.id,
        actorSessionId: null,
        actorIp: ctx.ip,
        actorUserAgent: ctx.userAgent,
        surface: 'systemd',
        action: 'systemd.bridge.approval_required',
        target: input.name,
        result: 'success',
        errorCode: null,
        requestId: ctx.requestId,
        payload: { phase: 'approval_required', op: policyName, actionHash },
      });
      return {
        status: 'approval_required',
        action: input.action,
        name: input.name,
        actionHash,
        ttlSec: APPROVAL_TTL_SEC,
        message: `Destructive systemd action '${input.action}' on '${input.name}' requires an approval token`,
      };
    }
    // Verify the token. We import lazily to keep the cold path light and
    // to surface import errors at request time, not at module load.
    //
    // The approval is bound to the caller's `SessionId` (THREAT_MODEL
    // §3.4, PB-1). The route layer passes the sessionId via
    // `event.locals.session.id`; here we accept a string and cast
    // at the boundary — the brand is enforced by the `mintApproval`
    // call site, not by the bridge.
    const { verifyApproval } = await import('../approval');
    const v = verifyApproval(ctx.approvalToken, ctx.sessionId as never);
    if (!v.ok) {
      const reason = `approval token ${v.reason}`;
      audit({
        actorUserId: ctx.user.id,
        actorSessionId: null,
        actorIp: ctx.ip,
        actorUserAgent: ctx.userAgent,
        surface: 'systemd',
        action: 'systemd.bridge.reject',
        target: input.name,
        result: 'denied',
        errorCode: v.reason,
        requestId: ctx.requestId,
        payload: { phase: 'approval_verify', op: policyName, reason: v.reason },
      });
      return {
        status: 'rejected',
        action: input.action,
        name: input.name,
        code:
          v.reason === 'expired'
            ? 'approval_expired'
            : v.reason === 'already_used'
              ? 'approval_already_used'
              : v.reason === 'session_mismatch'
                ? 'approval_session_mismatch'
                : 'approval_invalid',
        reason,
      };
    }
    // Bind the approval to this specific op + name (PB-5).
    if (v.claims.actionHash !== actionHash) {
      audit({
        actorUserId: ctx.user.id,
        actorSessionId: null,
        actorIp: ctx.ip,
        actorUserAgent: ctx.userAgent,
        surface: 'systemd',
        action: 'systemd.bridge.reject',
        target: input.name,
        result: 'denied',
        errorCode: 'approval_invalid',
        requestId: ctx.requestId,
        payload: {
          phase: 'approval_action_mismatch',
          expected: actionHash,
          got: v.claims.actionHash,
        },
      });
      return {
        status: 'rejected',
        action: input.action,
        name: input.name,
        code: 'approval_invalid',
        reason: 'approval token is not bound to this action + name',
      };
    }
  }

  // 5. Run the executor.
  try {
    const result = await executor({
      unit,
      action: input.action,
      user: ctx.user,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'systemd',
      action: 'systemd.bridge.dispatch',
      target: input.name,
      result: 'success',
      errorCode: null,
      requestId: ctx.requestId,
      payload: {
        op: policyName,
        exitCode: result.exitCode,
        stdoutBytes: result.stdout.length,
        stderrBytes: result.stderr.length,
      },
    });
    return {
      status: 'accepted',
      action: input.action,
      name: input.name,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      unit: result.unit,
      durationMs: Date.now() - t0,
    };
  } catch (e) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: 'systemd',
      action: 'systemd.bridge.dispatch',
      target: input.name,
      result: 'failure',
      errorCode: 'executor_error',
      requestId: ctx.requestId,
      payload: { op: policyName, error: (e as Error).message },
    });
    return {
      status: 'rejected',
      action: input.action,
      name: input.name,
      code: 'executor_error',
      reason: `executor error: ${(e as Error).message}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Allowlist projection — used by the +page.server.ts loader for the UI.
// ---------------------------------------------------------------------------

/**
 * Project the systemd-surface allowlist into a shape the UI can
 * render. Mirrors `listTerminalOps` in `terminal/pty-bridge.ts`.
 */
export function listUnitActions(): ReadonlyArray<{
  action: SystemdActionKind;
  description: string;
  requiresApproval: boolean;
}> {
  return (
    [
      'start',
      'stop',
      'restart',
      'reload',
      'status',
      'enable',
      'disable',
      'list-units',
    ] as const
  ).map((action) => {
    const policyName = `systemd.${action}`;
    const entry = allowlistedCommand(policyName);
    return {
      action,
      description: entry?.description ?? `systemd ${action} on an allowlisted unit.`,
      requiresApproval:
        entry?.requiresApproval ?? DESTRUCTIVE_ACTIONS.has(action),
    };
  });
}

// ---------------------------------------------------------------------------
// Convenience re-exports for tests / consumers.
// ---------------------------------------------------------------------------

/** The default seed. Exposed so tests can assert against a known set. */
export const _SEED_UNITS: readonly SystemdUnit[] = SEED_UNITS;

/** Re-export the schemas for tests + adapter. */
export { SystemdUnitSchema, SystemdLogLineSchema };
