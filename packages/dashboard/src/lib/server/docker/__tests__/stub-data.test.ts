/**
 * docker-stub-data.test.ts — coverage of the M2 in-memory docker
 * container store.
 *
 * Exercises every exported function and the edge cases of the
 * filter / query / state-machine / lookup logic.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  listContainers,
  getContainerById,
  getContainerByName,
  tailLogs,
  startContainer,
  stopContainer,
  restartContainer,
  removeContainer,
  _resetDockerStub,
  asContainerId,
} from '../stub-data';

beforeEach(() => {
  _resetDockerStub();
});

describe('docker stub-data — listContainers filters', () => {
  it('returns the seed by default', () => {
    const all = listContainers();
    expect(all.length).toBeGreaterThan(0);
  });

  it('filter=running returns only running containers', () => {
    const r = listContainers({ filter: 'running' });
    expect(r.every((c) => c.state === 'running')).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });

  it('filter=stopped returns exited + created + dead', () => {
    const r = listContainers({ filter: 'stopped' });
    expect(
      r.every((c) => c.state === 'exited' || c.state === 'created' || c.state === 'dead'),
    ).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });

  it('filter=paused returns only paused', () => {
    const r = listContainers({ filter: 'paused' });
    expect(r.every((c) => c.state === 'paused')).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });

  it('filter=restarting returns only restarting', () => {
    const r = listContainers({ filter: 'restarting' });
    expect(r.every((c) => c.state === 'restarting')).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });

  it('query filters by name (case-insensitive)', () => {
    const r = listContainers({ query: 'Caddy' });
    expect(r.length).toBe(1);
    expect(r[0]!.name).toBe('caddy-1');
  });

  it('query filters by image substring', () => {
    const r = listContainers({ query: 'postgres' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((c) => c.image.includes('postgres'))).toBe(true);
  });

  it('query filters by state', () => {
    const r = listContainers({ query: 'restarting' });
    expect(r.length).toBeGreaterThan(0);
  });

  it('query trims whitespace and is case-insensitive', () => {
    const r = listContainers({ query: '  CADDY  ' });
    expect(r.length).toBe(1);
  });

  it('empty query returns all', () => {
    const r = listContainers({ query: '   ' });
    expect(r.length).toBeGreaterThan(0);
  });
});

describe('docker stub-data — lookups', () => {
  it('getContainerById returns the container for a full id', () => {
    const all = listContainers();
    const c = getContainerById(all[0]!.id);
    expect(c).not.toBeNull();
    expect(c!.id).toBe(all[0]!.id);
  });

  it('getContainerById returns the container for a short id (suffix match)', () => {
    const all = listContainers();
    const fullId = all[0]!.id;
    // Use the last 12 hex chars.
    const shortId = fullId.slice(-12);
    const c = getContainerById(shortId);
    expect(c).not.toBeNull();
    expect(c!.id).toBe(fullId);
  });

  it('getContainerById returns null for an unknown id', () => {
    expect(getContainerById('sha256:zzz')).toBeNull();
  });

  it('getContainerById returns null for empty string', () => {
    expect(getContainerById('')).toBeNull();
  });

  it('getContainerByName returns the container for a name', () => {
    const c = getContainerByName('caddy-1');
    expect(c).not.toBeNull();
    expect(c!.name).toBe('caddy-1');
  });

  it('getContainerByName returns null for an unknown name', () => {
    expect(getContainerByName('no-such-container')).toBeNull();
  });

  it('getContainerByName returns null for empty string', () => {
    expect(getContainerByName('')).toBeNull();
  });
});

describe('docker stub-data — tailLogs', () => {
  it('returns the synthetic logs for caddy-1 (empty)', () => {
    const caddy = listContainers().find((c) => c.name === 'caddy-1')!;
    const logs = tailLogs(caddy.id, 10);
    // caddy-1 has no SYNTHETIC_LOGS entry, so this is empty.
    expect(Array.isArray(logs)).toBe(true);
  });

  it('returns the synthetic logs for grafana-1', () => {
    const grafana = listContainers().find((c) => c.name === 'grafana-1')!;
    const logs = tailLogs(grafana.id, 10);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]).toMatch(/Grafana/);
  });

  it('returns [] for an unknown container', () => {
    expect(tailLogs('does-not-exist', 5)).toEqual([]);
  });

  it('clamps n to [1, 1000]', () => {
    const c = listContainers()[0]!;
    const tiny = tailLogs(c.id, 0);
    expect(tiny.length).toBeLessThanOrEqual(1);
    const huge = tailLogs(c.id, 99999);
    expect(huge.length).toBeLessThanOrEqual(1000);
  });

  it('returns at most n lines', () => {
    const prom = listContainers().find((c) => c.name === 'prometheus-1')!;
    const logs = tailLogs(prom.id, 1);
    expect(logs.length).toBeLessThanOrEqual(1);
  });
});

describe('docker stub-data — state transitions', () => {
  // Look up the seeded sha256 IDs by name so we test the real
  // API (which expects an id, not a name).
  const ids = {
    postgres: listContainers().find((c) => c.name === 'postgres-1')!.id,
    caddy: listContainers().find((c) => c.name === 'caddy-1')!.id,
  };

  it('startContainer throws for an unknown id', () => {
    expect(() => startContainer('nope')).toThrow(/not found/);
  });

  it('startContainer sets state to running', () => {
    const c = startContainer(ids.postgres); // currently exited
    expect(c.state).toBe('running');
    expect(c.status).toBe('Up 0 seconds');
  });

  it('stopContainer throws for an unknown id', () => {
    expect(() => stopContainer('nope')).toThrow(/not found/);
  });

  it('stopContainer sets state to exited', () => {
    const c = stopContainer(ids.caddy); // currently running
    expect(c.state).toBe('exited');
    expect(c.status).toMatch(/Exited/);
  });

  it('restartContainer throws for an unknown id', () => {
    expect(() => restartContainer('nope')).toThrow(/not found/);
  });

  it('restartContainer sets state to running', () => {
    const c = restartContainer(ids.postgres);
    expect(c.state).toBe('running');
    expect(c.status).toMatch(/restarted/);
  });

  it('removeContainer returns false for unknown id', () => {
    expect(removeContainer('nope')).toBe(false);
  });

  it('removeContainer removes the container and returns true', () => {
    const before = listContainers().length;
    const ok = removeContainer(ids.caddy);
    expect(ok).toBe(true);
    expect(listContainers().length).toBe(before - 1);
  });
});

describe('docker stub-data — _resetDockerStub', () => {
  it('restores the seed after a remove', () => {
    const caddy = listContainers().find((c) => c.name === 'caddy-1')!;
    removeContainer(caddy.id);
    expect(listContainers().find((c) => c.name === 'caddy-1')).toBeUndefined();
    _resetDockerStub();
    expect(listContainers().find((c) => c.name === 'caddy-1')).toBeDefined();
  });
});

describe('asContainerId — branded type cast', () => {
  it('casts a string to ContainerId', () => {
    const id = asContainerId('sha256:abc');
    expect(id).toBe('sha256:abc');
  });
});
