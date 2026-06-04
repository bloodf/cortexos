/**
 * Adapter — bridge the in-memory Docker stub (and the legacy mock
 * entities) to the contracts `DockerContainer` shape used by the
 * UI.
 *
 * Why this exists:
 *   - The M2 stub exposes a `Container` with branded `ContainerId`,
 *     custom `logs`, and a `state` typed against the mocks' enum.
 *   - The contracts `DockerContainer` (from @cortexos/contracts)
 *     uses a plain string id, a `status: string | null`, and the
 *     contracts `state` enum.
 *   - The legacy mock entities have a `createdBy: string | null`
 *     and `networkMode: string | null` that don't exist in the
 *     contracts shape.
 *
 * The adapter centralizes the mapping so the UI never has to deal
 * with both shapes. The output is type-asserted to the contracts
 * `DockerContainer` — the assertions are safe because we control
 * both sides of the boundary and the contracts shape is a superset
 * of the input shape (modulo field renames).
 */
import type { DockerContainer, DockerContainerState } from '@cortexos/contracts';
import type { Container, ContainerId, ContainerState } from '$lib/server/docker/stub-data';

// ---------------------------------------------------------------------------
// Input shapes — the union of mock + stub
// ---------------------------------------------------------------------------

/**
 * Structural input — the adapter accepts either the stub's `Container`
 * (with `id: ContainerId`, `logs: string[]`) or the legacy mock
 * `DockerContainer` (plain string id, no logs). The contracts
 * shape is always the output.
 */
export interface AdapterInput {
  id: string;
  name: string;
  image: string;
  state: ContainerState | DockerContainerState | string;
  status: string;
  ports: ReadonlyArray<string>;
  created: string;
  privileged?: boolean;
  networks?: ReadonlyArray<string>;
  mounts?: ReadonlyArray<{ source: string; destination: string; mode: string }>;
  /** Legacy mock only. */
  createdBy?: string | null;
  /** Legacy mock only. */
  networkMode?: string | null;
  /** Stub only — ignored by the adapter (logs come from a separate endpoint). */
  logs?: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Casting helpers
// ---------------------------------------------------------------------------

function toState(s: string): DockerContainerState {
  return s as DockerContainerState;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a stub `Container` (or a mock entity) to the contracts
 * `DockerContainer` shape. The output satisfies the contracts Zod
 * schema for the field set M2 uses; new contracts fields must be
 * added here when they land.
 */
export function adaptContainer(input: AdapterInput): DockerContainer {
  const networks = input.networks
    ? Array.from(input.networks)
    : input.networkMode
      ? [input.networkMode]
      : [];
  return {
    id: input.id,
    name: input.name,
    image: input.image,
    state: toState(input.state),
    status: input.status ?? null,
    ports: Array.from(input.ports),
    created: input.created,
    privileged: input.privileged ?? false,
    networks,
    mounts: (input.mounts ?? []).map((m) => ({
      source: m.source,
      destination: m.destination,
      mode: m.mode,
    })),
  };
}

/** Adapt a list of inputs. Empty list is a no-op. */
export function adaptContainerList(rows: ReadonlyArray<AdapterInput>): DockerContainer[] {
  return rows.map(adaptContainer);
}

/** Convenience: adapt from a stub `Container` directly. */
export function adaptStubContainer(c: Container): DockerContainer {
  return adaptContainer({
    id: c.id as unknown as string,
    name: c.name,
    image: c.image,
    state: c.state,
    status: c.status,
    ports: c.ports,
    created: c.created,
    privileged: c.privileged,
    networks: c.networks,
    mounts: c.mounts,
    logs: c.logs,
  });
}

// ---------------------------------------------------------------------------
// Literal mirrors of the contracts unions
// ---------------------------------------------------------------------------
//
// Svelte components can't always resolve the contracts' Zod-inferred
// union types (svelte-check collapses them to `unknown` inside .svelte
// files). The literal mirrors here are what the component props use.
// Keep them in sync with `packages/contracts/src/entities/docker.ts`.

export type ContainerStateLit =
  | 'running'
  | 'exited'
  | 'paused'
  | 'restarting'
  | 'dead'
  | 'created'
  | 'removing';

export const CONTAINER_STATES: ReadonlyArray<ContainerStateLit> = [
  'running',
  'exited',
  'paused',
  'restarting',
  'dead',
  'created',
  'removing',
];

/** Map a contracts state to the badge variant the design system exposes. */
export type ContainerStateVariant = 'success' | 'destructive' | 'warning' | 'info' | 'secondary';

export function stateVariant(s: ContainerStateLit): ContainerStateVariant {
  switch (s) {
    case 'running':
      return 'success';
    case 'exited':
      return 'destructive';
    case 'restarting':
      return 'warning';
    case 'paused':
      return 'info';
    case 'created':
    case 'removing':
    case 'dead':
      return 'secondary';
    default: {
      const _exhaustive: never = s;
      return _exhaustive;
    }
  }
}

/** Map a contracts state to a stable i18n key suffix. */
export function stateI18nKey(s: ContainerStateLit): string {
  return s;
}

// ---------------------------------------------------------------------------
// Internal — re-export the branded id type for test fixtures
// ---------------------------------------------------------------------------
export type { ContainerId };
