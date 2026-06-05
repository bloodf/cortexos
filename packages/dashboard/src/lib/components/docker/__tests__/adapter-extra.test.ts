// @vitest-environment node
/**
 * docker-adapter-extra.test.ts — coverage of the remaining branches
 * in `src/lib/components/docker/adapter.ts`.
 *
 * The base test (if any) covers the happy path. This file drives:
 *
 *   - L77  networks fallback to `networkMode` when `networks` is absent
 *   - L83  `status ?? null` branch (when status is undefined)
 *   - L86  `privileged ?? false` branch (when privileged is undefined)
 *   - L88  `mounts ?? []` branch (when mounts is undefined)
 *   - L164 stateVariant `default` (exhaustive-check) branch
 *   - L172 stateI18nKey
 */
import { describe, it, expect } from 'vitest';
import {
  adaptContainer,
  adaptContainerList,
  adaptStubContainer,
  stateVariant,
  stateI18nKey,
  CONTAINER_STATES,
  type AdapterInput,
} from '../adapter';
import type { Container, ContainerState } from '$lib/server/docker/stub-data';

describe('docker adapter — adaptContainer defaults', () => {
  it('falls back to networkMode when networks is missing', () => {
    const out = adaptContainer({
      id: 'c1',
      name: 'demo',
      image: 'nginx:1',
      state: 'running',
      status: 'Up',
      ports: [],
      created: '2026-01-01T00:00:00Z',
      networkMode: 'bridge',
    } as AdapterInput);
    expect(out.networks).toEqual(['bridge']);
  });

  it('uses empty networks array when neither networks nor networkMode is set', () => {
    const out = adaptContainer({
      id: 'c1',
      name: 'demo',
      image: 'nginx:1',
      state: 'running',
      status: 'Up',
      ports: [],
      created: '2026-01-01T00:00:00Z',
    } as AdapterInput);
    expect(out.networks).toEqual([]);
  });

  it('coerces undefined status to null', () => {
    const out = adaptContainer({
      id: 'c1',
      name: 'demo',
      image: 'nginx:1',
      state: 'running',
      // status omitted
      ports: [],
      created: '2026-01-01T00:00:00Z',
    } as unknown as AdapterInput);
    expect(out.status).toBeNull();
  });

  it('coerces undefined privileged to false', () => {
    const out = adaptContainer({
      id: 'c1',
      name: 'demo',
      image: 'nginx:1',
      state: 'running',
      status: 'Up',
      ports: [],
      created: '2026-01-01T00:00:00Z',
      // privileged omitted
    } as unknown as AdapterInput);
    expect(out.privileged).toBe(false);
  });

  it('coerces undefined mounts to an empty array', () => {
    const out = adaptContainer({
      id: 'c1',
      name: 'demo',
      image: 'nginx:1',
      state: 'running',
      status: 'Up',
      ports: [],
      created: '2026-01-01T00:00:00Z',
      // mounts omitted
    } as unknown as AdapterInput);
    expect(out.mounts).toEqual([]);
  });
});

describe('docker adapter — adaptContainerList', () => {
  it('returns an empty array for an empty input', () => {
    expect(adaptContainerList([])).toEqual([]);
  });

  it('maps a list of inputs in order', () => {
    const out = adaptContainerList([
      {
        id: 'a',
        name: 'a',
        image: 'x',
        state: 'running',
        status: 'Up',
        ports: [],
        created: '2026-01-01T00:00:00Z',
      } as AdapterInput,
      {
        id: 'b',
        name: 'b',
        image: 'y',
        state: 'exited',
        status: 'Down',
        ports: [],
        created: '2026-01-01T00:00:00Z',
      } as AdapterInput,
    ]);
    expect(out.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('docker adapter — adaptStubContainer', () => {
  it('adapts a stub Container', () => {
    const stub: Container = {
      id: 'stub-1' as unknown as Container['id'],
      name: 'stub',
      image: 'nginx:1',
      state: 'running' as ContainerState,
      status: 'Up 5 minutes',
      ports: ['80:80'],
      created: '2026-01-01T00:00:00Z',
      privileged: false,
      networks: ['bridge'],
      mounts: [],
      logs: [],
    };
    const out = adaptStubContainer(stub);
    expect(out.id).toBe('stub-1');
    expect(out.name).toBe('stub');
    expect(out.networks).toEqual(['bridge']);
  });
});

describe('docker adapter — stateVariant', () => {
  it('maps every CONTAINER_STATES entry to a valid variant', () => {
    for (const s of CONTAINER_STATES) {
      const v = stateVariant(s);
      expect([
        'success',
        'destructive',
        'warning',
        'info',
        'secondary',
      ]).toContain(v);
    }
  });

  it('returns the input through the "exhaustive" never-branch (defensive runtime)', () => {
    // The `default` arm of the switch is a TS exhaustiveness check
    // (`const _exhaustive: never = s`). At runtime it's a no-op
    // pass-through (`return _exhaustive` returns the value of `s`).
    // Hit it via a runtime cast to satisfy TS.
    const v = stateVariant('unknown' as never);
    expect(v).toBe('unknown');
  });
});

describe('docker adapter — stateI18nKey', () => {
  it('returns the state name as the i18n key suffix', () => {
    expect(stateI18nKey('running')).toBe('running');
    expect(stateI18nKey('exited')).toBe('exited');
    expect(stateI18nKey('paused')).toBe('paused');
  });
});
