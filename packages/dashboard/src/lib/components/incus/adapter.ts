/**
 * adapter.ts — surface re-exports + thin view-model helpers for the
 * Incus feature.
 *
 * The contracts package is the single source of truth for the wire
 * shape. This file:
 *   - re-exports the contracts types so call sites import from
 *     `$lib/components/incus/adapter` rather than the deeper path
 *   - exposes a small set of view-model helpers (filter, count,
 *     label) the components need
 *
 * The `IncusExecutor` is the swappable bridge boundary; we re-export
 * its type so the components can refer to it without reaching into
 * the server module.
 */
import type {
  IncusInstance,
  IncusInstanceStatus,
  IncusInstanceType,
} from '@cortexos/contracts';
import type { IncusActionKind, IncusLogLine } from '$lib/server/incus/bridge';

// ---------------------------------------------------------------------------
// Re-exports — the Incus feature's public surface
// ---------------------------------------------------------------------------

export type { IncusInstance, IncusInstanceStatus, IncusInstanceType, IncusActionKind, IncusLogLine };

// ---------------------------------------------------------------------------
// Literal mirrors of the contracts unions
// ---------------------------------------------------------------------------
//
// Svelte components can't always resolve the contracts' Zod-inferred
// union types (svelte-check collapses them to `unknown` inside .svelte
// files). The literal mirrors here are what the component props use.

/**
 * Mirror the `IncusInstanceStatus` union. The M2 status set is the
 * 5-state provisioning lifecycle (draft|validated|provisioning|active|failed)
 * plus the 4-state live runtime (running|stopped|frozen|error).
 */
export type IncusStatusLit =
  | 'draft'
  | 'validated'
  | 'provisioning'
  | 'active'
  | 'failed'
  | 'running'
  | 'stopped'
  | 'frozen'
  | 'error';

export const INCUS_STATUSES: ReadonlyArray<IncusStatusLit> = [
  'draft',
  'validated',
  'provisioning',
  'active',
  'failed',
  'running',
  'stopped',
  'frozen',
  'error',
];

/** Mirror the `IncusInstanceType` union. */
export type IncusTypeLit = 'container' | 'vm';
export const INCUS_TYPES: ReadonlyArray<IncusTypeLit> = ['container', 'vm'];

// ---------------------------------------------------------------------------
// View-model helpers
// ---------------------------------------------------------------------------

/**
 * The closed set of filters the list page supports. Mirrors the
 * `?status=` and `?type=` query-param contracts.
 */
export type StatusFilter = 'all' | IncusStatusLit;
export type TypeFilter = 'all' | IncusTypeLit;

/**
 * True when the status is a "live" runtime state (post-launch).
 */
export function isLiveStatus(s: IncusStatusLit): boolean {
  return s === 'running' || s === 'stopped' || s === 'frozen' || s === 'error';
}

/**
 * True when the status is a "successful" / running state.
 */
export function isActiveStatus(s: IncusStatusLit): boolean {
  return s === 'active' || s === 'running';
}

/**
 * True when the status indicates the instance is provisioning but
 * not yet active.
 */
export function isPendingStatus(s: IncusStatusLit): boolean {
  return s === 'draft' || s === 'validated' || s === 'provisioning';
}

/**
 * Apply the free-text search query (matches name or image substring,
 * case-insensitive). Empty query = pass-through.
 */
export function filterByQuery(
  instances: readonly IncusInstance[],
  query: string,
): IncusInstance[] {
  const q = query.trim().toLowerCase();
  if (!q) return instances.slice();
  return instances.filter(
    (i) => i.name.toLowerCase().includes(q) || i.image.toLowerCase().includes(q),
  );
}

/**
 * Apply the status filter. Pure: same input → same output.
 */
export function filterByStatus(
  instances: readonly IncusInstance[],
  filter: StatusFilter,
): IncusInstance[] {
  if (filter === 'all') return instances.slice();
  return instances.filter((i) => i.status === filter);
}

/**
 * Apply the type filter.
 */
export function filterByType(
  instances: readonly IncusInstance[],
  filter: TypeFilter,
): IncusInstance[] {
  if (filter === 'all') return instances.slice();
  return instances.filter((i) => i.type === filter);
}

/**
 * Count instances grouped by status. Used by the page header to
 * surface the `N total · M active · K failed` summary.
 */
export function countByStatus(instances: readonly IncusInstance[]): {
  total: number;
  active: number;
  failed: number;
  pending: number;
  other: number;
} {
  let active = 0;
  let failed = 0;
  let pending = 0;
  let other = 0;
  for (const inst of instances) {
    if (isActiveStatus(inst.status)) active += 1;
    else if (inst.status === 'failed' || inst.status === 'error') failed += 1;
    else if (isPendingStatus(inst.status)) pending += 1;
    else other += 1;
  }
  return { total: instances.length, active, failed, pending, other };
}

/**
 * The set of actions that are "destructive" — they need an approval
 * token per PB-5. Mirrors the bridge's `DESTRUCTIVE_ACTIONS` set.
 */
export const DESTRUCTIVE_ACTIONS: ReadonlySet<IncusActionKind> = new Set<IncusActionKind>([
  'stop',
  'restart',
  'delete',
]);

/**
 * True iff the action requires an approval token.
 */
export function requiresApproval(action: IncusActionKind): boolean {
  return DESTRUCTIVE_ACTIONS.has(action);
}

/**
 * Map an `IncusStatusLit` to a design-system `Badge` variant. The
 * switch is exhaustive — adding a state without a handler is a
 * compile error.
 */
export type IncusStateVariant =
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'secondary'
  | 'outline';

export function stateVariant(s: IncusStatusLit): IncusStateVariant {
  switch (s) {
    case 'active':
    case 'running':
      return 'success';
    case 'failed':
    case 'error':
      return 'destructive';
    case 'draft':
    case 'validated':
      return 'outline';
    case 'provisioning':
      return 'info';
    case 'stopped':
      return 'secondary';
    case 'frozen':
      return 'warning';
    default: {
      const _exhaustive: never = s;
      return _exhaustive;
    }
  }
}

/** Format a log line as `2026-01-02T03:04:05Z [info] message`. */
export function formatLogLine(line: IncusLogLine): string {
  return `${line.ts} [${line.priority}] ${line.message}`;
}

/** Format CPU + memory as a compact display string. */
export function formatResources(
  inst: IncusInstance,
): { cpu: string; memory: string } {
  const cpu = inst.cpu != null ? `${inst.cpu} vCPU` : '—';
  const memory =
    inst.memory != null
      ? inst.memory >= 1024
        ? `${(inst.memory / 1024).toFixed(1)} GiB`
        : `${inst.memory} MiB`
      : '—';
  return { cpu, memory };
}

/**
 * True when the instance is currently running and the user can
 * stop / restart it. False for failed / draft / stopped states.
 */
export function isRunning(inst: IncusInstance): boolean {
  return inst.status === 'active' || inst.status === 'running';
}

/** Re-export the executor type for components. */
export type { IncusExecutor } from '$lib/server/incus/bridge';
