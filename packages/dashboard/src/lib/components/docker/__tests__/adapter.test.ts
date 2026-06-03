/**
 * adapter.test.ts — exercises the mock/stub → contracts
 * `DockerContainer` bridge. The adapter is the only place that
 * knows the rename rules (ContainerId → string, `state: 'running'`
 * → contracts state union, `logs` field ignored), so the
 * assertions here are the safety net.
 */
import { describe, it, expect } from 'vitest';
import {
  adaptContainer,
  adaptContainerList,
  adaptStubContainer,
  stateVariant,
  CONTAINER_STATES,
  type ContainerStateLit,
} from '../adapter';
import { asContainerId } from '$lib/server/docker/stub-data';
import { FROZEN_NOW } from '../../../mocks/fixtures/seed';

function mockContainer(overrides: Partial<Parameters<typeof adaptContainer>[0]> = {}): Parameters<typeof adaptContainer>[0] {
  return {
    id: 'sha256:abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
    name: 'grafana-1',
    image: 'grafana/grafana:11.2.0',
    state: 'running',
    status: 'Up 2 hours',
    ports: ['3000:3000'],
    created: FROZEN_NOW,
    privileged: false,
    networks: ['monitoring', 'bridge'],
    mounts: [
      { source: 'grafana-data', destination: '/var/lib/grafana', mode: 'rw' },
    ],
    ...overrides,
  };
}

describe('adapter — stub/mock → contracts DockerContainer', () => {
  it('adaptContainer maps a happy-path container', () => {
    const out = adaptContainer(mockContainer());
    expect(out.id).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(out.name).toBe('grafana-1');
    expect(out.image).toBe('grafana/grafana:11.2.0');
    expect(out.state).toBe('running');
    expect(out.status).toBe('Up 2 hours');
    expect(out.ports).toEqual(['3000:3000']);
    expect(out.networks).toEqual(['monitoring', 'bridge']);
    expect(out.privileged).toBe(false);
    expect(out.mounts).toHaveLength(1);
    expect(out.mounts[0]?.source).toBe('grafana-data');
  });

  it('adaptContainer passes status through as null when missing', () => {
    const out = adaptContainer(mockContainer({ status: undefined }));
    expect(out.status).toBeNull();
  });

  it('adaptContainer handles the legacy mock networkMode field', () => {
    const out = adaptContainer(
      mockContainer({ networks: undefined, networkMode: 'bridge' }),
    );
    expect(out.networks).toEqual(['bridge']);
  });

  it('adaptContainerList handles empty arrays', () => {
    expect(adaptContainerList([])).toEqual([]);
  });

  it('adaptStubContainer adapts the stub Container shape directly', () => {
    const stub = {
      id: asContainerId('sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
      name: 'prometheus-1',
      image: 'prom/prometheus:v2.55.0',
      state: 'running' as const,
      status: 'Up 2 hours',
      ports: ['9090:9090'],
      created: FROZEN_NOW,
      privileged: false,
      networks: ['monitoring'],
      mounts: [],
      logs: ['line 1', 'line 2'],
    };
    const out = adaptStubContainer(stub);
    expect(out.id).toContain('1234567890abcdef');
    expect(out.name).toBe('prometheus-1');
    expect(out.image).toBe('prom/prometheus:v2.55.0');
    expect(out.state).toBe('running');
    expect(out.ports).toEqual(['9090:9090']);
    // Logs are intentionally NOT part of the contracts shape — the
    // adapter strips them. Tests for the logs UI get them via the
    // tailLogs() function in the stub-data module.
  });

  it('stateVariant is exhaustive over the contracts state union', () => {
    const states: ReadonlyArray<ContainerStateLit> = [
      'running',
      'exited',
      'paused',
      'restarting',
      'dead',
      'created',
      'removing',
    ];
    for (const s of states) {
      const v = stateVariant(s);
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
    // And the variant matches the state.
    expect(stateVariant('running')).toBe('success');
    expect(stateVariant('exited')).toBe('destructive');
    expect(stateVariant('restarting')).toBe('warning');
    expect(stateVariant('paused')).toBe('info');
  });

  it('CONTAINER_STATES includes every contracts state', () => {
    expect(CONTAINER_STATES).toContain('running');
    expect(CONTAINER_STATES).toContain('exited');
    expect(CONTAINER_STATES).toContain('paused');
    expect(CONTAINER_STATES).toContain('restarting');
    expect(CONTAINER_STATES).toContain('dead');
    expect(CONTAINER_STATES).toContain('created');
    expect(CONTAINER_STATES).toContain('removing');
  });
});
