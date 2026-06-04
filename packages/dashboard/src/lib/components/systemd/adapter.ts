/**
 * adapter.ts — surface re-exports + thin view-model helpers for the
 * systemd feature.
 *
 * The contracts package is the single source of truth for the wire
 * shape. This file:
 *   - re-exports the contracts types so call sites import from
 *     `$lib/components/systemd/adapter` rather than the deeper path
 *   - exposes a small set of view-model helpers (group/filter/label)
 *     the components need
 *
 * The "adapter" naming mirrors the services feature's `adapter.ts`,
 * which centralises the bridge between the mock + the contracts
 * shape. Here the contracts shape is stable; the helper set is
 * therefore tiny.
 */

import type {
  SystemdUnit,
  SystemdActiveState,
  SystemdLogLine,
} from '@cortexos/contracts';

// ---------------------------------------------------------------------------
// Re-exports — the systemd feature's public surface
// ---------------------------------------------------------------------------

export type { SystemdUnit, SystemdActiveState, SystemdLogLine };

// ---------------------------------------------------------------------------
// View-model helpers — pure functions, no Svelte / DOM dependencies
// ---------------------------------------------------------------------------

/**
 * The closed set of filters the list page supports. Mirrors the
 * `?state=` query-param contract.
 */
export type StateFilter = 'all' | 'active' | 'inactive' | 'failed';

/**
 * Apply the state filter. Pure: same input → same output. Exported so
 * the page server and the unit list component share one implementation.
 */
export function filterByState(
  units: readonly SystemdUnit[],
  filter: StateFilter,
): SystemdUnit[] {
  if (filter === 'all') return units.slice();
  if (filter === 'active') return units.filter((u) => u.active === 'active');
  if (filter === 'inactive') return units.filter((u) => u.active === 'inactive');
  if (filter === 'failed') return units.filter((u) => u.active === 'failed');
  return units.slice();
}

/**
 * Count units in each state. Used by the page header to surface the
 * `N units · M active` summary.
 */
export function countByState(
  units: readonly SystemdUnit[],
): { total: number; active: number; inactive: number; failed: number } {
  let active = 0;
  let inactive = 0;
  let failed = 0;
  for (const u of units) {
    if (u.active === 'active') active += 1;
    else if (u.active === 'inactive') inactive += 1;
    else if (u.active === 'failed') failed += 1;
  }
  return { total: units.length, active, inactive, failed };
}

/**
 * The closed set of admin actions. Mirrors `SystemdActionKind` from
 * the contracts package — re-declared so svelte-check can analyse
 * the switch over actions in `UnitActionBar.svelte` exhaustively.
 */
export type UnitActionKind =
  | 'start'
  | 'stop'
  | 'restart'
  | 'reload'
  | 'enable'
  | 'disable';

/**
 * The set of actions that are "destructive" — they need an approval
 * token per PB-5. The list is hand-rolled (rather than reading
 * `policy.json`) so the UI can render the warning state without a
 * policy-module import.
 */
export const DESTRUCTIVE_ACTIONS: ReadonlySet<UnitActionKind> = new Set<UnitActionKind>([
  'restart',
  'stop',
  'disable',
]);

/**
 * True iff the action requires an approval token.
 */
export function requiresApproval(action: UnitActionKind): boolean {
  return DESTRUCTIVE_ACTIONS.has(action);
}

/**
 * True iff the given active state is "running" (active + sub=running).
 * The list page uses this to drive the icon variant; the detail page
 * uses it to drive the action-bar default.
 */
export function isRunning(unit: SystemdUnit): boolean {
  return unit.active === 'active' && unit.sub === 'running';
}

/**
 * Mirror the contracts `SystemdActiveState` union so svelte-check can
 * see it. The contracts' Zod-inferred type is opaque to the Svelte
 * compiler — re-declaring keeps the `computeVariant` switch statically
 * exhaustively typed.
 */
export type ActiveStateLit =
  | 'active'
  | 'inactive'
  | 'failed'
  | 'activating'
  | 'deactivating'
  | 'reloading'
  | 'maintenance'
  | 'unknown';

/** Format a log line as `2026-01-02T03:04:05Z [info] message`. */
export function formatLogLine(line: SystemdLogLine): string {
  return `${line.ts} [${line.priority}] ${line.message}`;
}

/** Strip the `.service` suffix from a unit name for friendlier display. */
export function shortName(name: string): string {
  return name.replace(/\.service$/, '');
}
