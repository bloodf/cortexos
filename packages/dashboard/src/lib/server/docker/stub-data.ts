/**
 * In-memory Docker stub — M2 mock for the M3 real docker socket.
 *
 * Each container has a stable id (sha256-style 12-char hex or a full
 * sha256: prefix), a name, an image, a state, and the inspect-time
 * metadata. The store resets per process (no persistence). The M2
 * docker bridge (`./bridge.ts`) dispatches against this store via
 * the swappable Executor — the same allowlist + approval gate that
 * M3 will use against the real socket.
 *
 * Determinism: no `Date.now()` in the seed. The seed uses a frozen
 * timestamp so the visible timestamps are stable across requests.
 *
 * The state machine (used by the route form actions) is a deliberate
 * subset of Docker's actual state machine: we only support the
 * transitions the UI exposes (start, stop, restart, rm). Anything
 * else is rejected at the bridge level.
 */
import { FROZEN_NOW } from '../../mocks/fixtures/seed';
import { DOCKER_STATES } from '../../mocks/contracts/enums';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Branded id primitive — match the contracts `DockerContainer.id`
 * shape (sha256:hex or a 12-64 char hex string).
 */
export type ContainerId = string & { readonly __brand: 'ContainerId' };

export const asContainerId = (s: string): ContainerId => s as ContainerId;

export type ContainerState = (typeof DOCKER_STATES)[number];

/** Mounts (host:container[:ro]) — same shape the contracts use. */
export interface ContainerMount {
  source: string;
  destination: string;
  mode: string;
}

export interface Container {
  readonly id: ContainerId;
  readonly name: string;
  readonly image: string;
  readonly state: ContainerState;
  /** Free-form status text (e.g. "Up 3 days"). */
  readonly status: string;
  readonly ports: ReadonlyArray<string>;
  readonly created: string;
  readonly privileged: boolean;
  readonly networks: ReadonlyArray<string>;
  readonly mounts: ReadonlyArray<ContainerMount>;
  /**
   * Last N log lines kept in memory. The M2 stub does not actually
   * read docker logs — the bridge records the call and returns a
   * synthetic "Up 3 days / latest: …" message. M3 replaces this
   * with `docker logs --tail <N> <id>`.
   */
  readonly logs: ReadonlyArray<string>;
}

export type ContainerFilter = 'all' | 'running' | 'stopped' | 'paused' | 'restarting';

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

function frozenMinusMinutes(minutes: number): string {
  // Deterministic: FROZEN_NOW minus N minutes, formatted as ISO.
  // No Date.now() — we work in ms from a frozen epoch.
  const t = Date.parse(FROZEN_NOW) - minutes * 60_000;
  return new Date(t).toISOString();
}

const SEED: ReadonlyArray<Omit<Container, 'logs'>> = [
  {
    id: asContainerId('sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    name: 'grafana-1',
    image: 'grafana/grafana:11.2.0',
    state: 'running',
    status: 'Up 2 hours',
    ports: ['3000:3000'],
    created: frozenMinusMinutes(120),
    privileged: false,
    networks: ['monitoring', 'bridge'],
    mounts: [
      { source: 'grafana-data', destination: '/var/lib/grafana', mode: 'rw' },
    ],
  },
  {
    id: asContainerId('sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
    name: 'prometheus-1',
    image: 'prom/prometheus:v2.55.0',
    state: 'running',
    status: 'Up 2 hours',
    ports: ['9090:9090'],
    created: frozenMinusMinutes(120),
    privileged: false,
    networks: ['monitoring'],
    mounts: [
      { source: 'prometheus-data', destination: '/prometheus', mode: 'rw' },
    ],
  },
  {
    id: asContainerId('sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'),
    name: 'alertmanager-1',
    image: 'prom/alertmanager:v0.27.0',
    state: 'running',
    status: 'Up 2 hours',
    ports: ['9093:9093'],
    created: frozenMinusMinutes(120),
    privileged: false,
    networks: ['monitoring'],
    mounts: [],
  },
  {
    id: asContainerId('sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'),
    name: 'caddy-1',
    image: 'caddy:2.8-alpine',
    state: 'running',
    status: 'Up 4 hours',
    ports: ['80:80', '443:443'],
    created: frozenMinusMinutes(240),
    privileged: false,
    networks: ['bridge'],
    mounts: [
      { source: '/etc/caddy', destination: '/etc/caddy', mode: 'ro' },
    ],
  },
  {
    id: asContainerId('sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'),
    name: 'postgres-1',
    image: 'postgres:16-alpine',
    state: 'exited',
    status: 'Exited (0) 30 minutes ago',
    ports: ['5432:5432'],
    created: frozenMinusMinutes(600),
    privileged: false,
    networks: ['bridge'],
    mounts: [
      { source: 'postgres-data', destination: '/var/lib/postgresql/data', mode: 'rw' },
    ],
  },
  {
    id: asContainerId('sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
    name: 'ollama-1',
    image: 'ollama/ollama:0.5.7',
    state: 'restarting',
    status: 'Restarting (1) 30 seconds ago',
    ports: ['11434:11434'],
    created: frozenMinusMinutes(90),
    privileged: false,
    networks: ['bridge'],
    mounts: [
      { source: 'ollama-models', destination: '/root/.ollama', mode: 'rw' },
    ],
  },
  {
    id: asContainerId('sha256:11111111111111111111111111111111111111111111111111111111111111aa'),
    name: '9router-1',
    image: 'ghcr.io/cortexos/9router:0.4.2',
    state: 'paused',
    status: 'Paused (0) 5 minutes ago',
    ports: ['11434:11434'],
    created: frozenMinusMinutes(300),
    privileged: false,
    networks: ['bridge'],
    mounts: [],
  },
  {
    id: asContainerId('sha256:22222222222222222222222222222222222222222222222222222222222222bb'),
    name: 'mail-guardian-1',
    image: 'ghcr.io/cortexos/mail-guardian:0.2.1',
    state: 'created',
    status: 'Created',
    ports: [],
    created: frozenMinusMinutes(15),
    privileged: false,
    networks: [],
    mounts: [],
  },
];

/** Synthetic per-container log lines. M3 replaces with `docker logs`. */
const SYNTHETIC_LOGS: Readonly<Record<string, ReadonlyArray<string>>> = {
  'grafana-1': [
    't=2026-06-03T13:00:00 lvl=info msg="Starting Grafana" version=11.2.0',
    't=2026-06-03T13:00:01 lvl=info msg="HTTP Server Listen" address=[::]:3000',
    't=2026-06-03T13:00:02 lvl=info msg="Database initialized" dbtype=sqlite3',
  ],
  'prometheus-1': [
    'level=info ts=2026-06-03T13:00:00 caller=main.go:567 msg="Starting Prometheus" version="(version=2.55.0, branch=HEAD, revision=...)"',
    'level=info ts=2026-06-03T13:00:01 caller=web.go:571 component=web msg="Start listening for connections" address=0.0.0.0:9090',
  ],
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let containers: Container[] = SEED.map((c) => ({
  ...c,
  logs: SYNTHETIC_LOGS[c.name] ?? [],
}));

// ---------------------------------------------------------------------------
// Public API — read
// ---------------------------------------------------------------------------

/** List containers, optionally filtered by state and free-text query. */
export function listContainers(
  opts: { filter?: ContainerFilter; query?: string } = {},
): Container[] {
  let rows = containers.slice();
  const filter = opts.filter ?? 'all';
  if (filter === 'running') {
    rows = rows.filter((c) => c.state === 'running');
  } else if (filter === 'stopped') {
    rows = rows.filter((c) => c.state === 'exited' || c.state === 'created' || c.state === 'dead');
  } else if (filter === 'paused') {
    rows = rows.filter((c) => c.state === 'paused');
  } else if (filter === 'restarting') {
    rows = rows.filter((c) => c.state === 'restarting');
  }
  const needle = (opts.query ?? '').trim().toLowerCase();
  if (needle) {
    rows = rows.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.image.toLowerCase().includes(needle) ||
        c.state.toLowerCase().includes(needle),
    );
  }
  return rows;
}

/** Look up a container by id (sha256:hex or short hex). */
export function getContainerById(id: string): Container | null {
  if (!id) return null;
  return containers.find((c) => c.id === id || c.id.endsWith(id)) ?? null;
}

/** Look up a container by name (legacy links may use the name). */
export function getContainerByName(name: string): Container | null {
  if (!name) return null;
  return containers.find((c) => c.name === name) ?? null;
}

/** Return the last N log lines for a container. */
export function tailLogs(id: string, n: number): string[] {
  const c = getContainerById(id);
  if (!c) return [];
  const max = Math.max(1, Math.min(1000, n));
  return c.logs.slice(-max);
}

// ---------------------------------------------------------------------------
// Public API — write (the lifecycle actions the bridge drives)
// ---------------------------------------------------------------------------

/**
 * State transitions supported by the M2 stub. Anything else throws
 * an error so the bridge records a failure and returns `executor_error`.
 */
function setState(c: Container, next: ContainerState, status: string): Container {
  const idx = containers.findIndex((x) => x.id === c.id);
  if (idx < 0) return c;
  const updated: Container = { ...c, state: next, status };
  containers[idx] = updated;
  return updated;
}

export function startContainer(id: string): Container {
  const c = getContainerById(id);
  if (!c) throw new Error(`Container '${id}' not found`);
  return setState(c, 'running', 'Up 0 seconds');
}

export function stopContainer(id: string): Container {
  const c = getContainerById(id);
  if (!c) throw new Error(`Container '${id}' not found`);
  return setState(c, 'exited', 'Exited (0) 0 seconds ago');
}

export function restartContainer(id: string): Container {
  const c = getContainerById(id);
  if (!c) throw new Error(`Container '${id}' not found`);
  return setState(c, 'running', 'Up 0 seconds (restarted)');
}

export function removeContainer(id: string): boolean {
  const idx = containers.findIndex((c) => c.id === id || c.id.endsWith(id));
  if (idx < 0) return false;
  containers.splice(idx, 1);
  return true;
}

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/** Reset the store to the seed. For tests. */
export function _resetDockerStub(): void {
  containers = SEED.map((c) => ({
    ...c,
    logs: SYNTHETIC_LOGS[c.name] ?? [],
  }));
}
