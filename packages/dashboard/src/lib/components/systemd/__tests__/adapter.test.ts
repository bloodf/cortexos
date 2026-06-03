/**
 * adapter.test.ts — view-model helpers + bridge defaults.
 *
 * The bridge is the security-critical seam (PB-5 + SR-019). These
 * tests exercise:
 *   - `filterByState` (all/active/inactive/failed)
 *   - `countByState` (matches the page header counts)
 *   - `DESTRUCTIVE_ACTIONS` membership (the destructive subset per
 *     PB-5)
 *   - `isRunning` (drives the action bar's default state)
 *   - the bridge's default seed + loaders (read-only paths)
 *   - the bridge's `dispatchAction` rejection paths (no approval
 *     token for destructive actions; unknown op; unknown unit; unit
 *     not allowlisted; invalid unit name)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  filterByState,
  countByState,
  DESTRUCTIVE_ACTIONS,
  isRunning,
  requiresApproval,
  shortName,
  formatLogLine,
} from '../adapter';
import {
  _getMockExecutorForTests,
  _resetSystemdBridgeForTests,
  listUnits,
  getUnit,
  listLogs,
  listUnitActions,
  dispatchAction,
  type DispatchContext,
} from '$lib/server/systemd/bridge';
import type { SystemdUnit, SystemdActionKind, SystemdUnit as Unit } from '@cortexos/contracts';
import type { User } from '$lib/server/entities';

const SEED: readonly SystemdUnit[] = _getMockExecutorForTests().list();

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u_test' as User['id'],
    username: 'tester',
    is_admin: true,
    isActive: true,
    groupMemberships: ['cortexos-admin'],
    ...overrides,
  } as User;
}

beforeEach(() => {
  _resetSystemdBridgeForTests();
});

describe('adapter — view-model helpers', () => {
  it('filterByState splits the seed by active/inactive/failed', () => {
    const all = filterByState(SEED, 'all');
    const active = filterByState(SEED, 'active');
    const inactive = filterByState(SEED, 'inactive');
    const failed = filterByState(SEED, 'failed');
    expect(all.length).toBe(SEED.length);
    expect(active.length + inactive.length + failed.length).toBe(SEED.length);
    expect(active.every((u) => u.active === 'active')).toBe(true);
    expect(inactive.every((u) => u.active === 'inactive')).toBe(true);
    expect(failed.every((u) => u.active === 'failed')).toBe(true);
  });

  it('countByState matches filterByState counts', () => {
    const counts = countByState(SEED);
    expect(counts.total).toBe(SEED.length);
    expect(counts.active).toBe(filterByState(SEED, 'active').length);
    expect(counts.inactive).toBe(filterByState(SEED, 'inactive').length);
    expect(counts.failed).toBe(filterByState(SEED, 'failed').length);
  });

  it('DESTRUCTIVE_ACTIONS contains the PB-5 destructive subset', () => {
    expect(DESTRUCTIVE_ACTIONS.has('restart')).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has('stop')).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has('disable')).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has('start')).toBe(false);
    expect(DESTRUCTIVE_ACTIONS.has('enable')).toBe(false);
    expect(DESTRUCTIVE_ACTIONS.has('reload')).toBe(false);
  });

  it('requiresApproval mirrors DESTRUCTIVE_ACTIONS', () => {
    for (const a of ['start', 'stop', 'restart', 'reload', 'enable', 'disable'] as const) {
      expect(requiresApproval(a)).toBe(DESTRUCTIVE_ACTIONS.has(a));
    }
  });

  it('isRunning returns true iff active+running', () => {
    const a: SystemdUnit = { ...SEED[0]!, active: 'active', sub: 'running' };
    const b: SystemdUnit = { ...SEED[0]!, active: 'active', sub: 'start-pre' };
    const c: SystemdUnit = { ...SEED[0]!, active: 'inactive', sub: 'dead' };
    expect(isRunning(a)).toBe(true);
    expect(isRunning(b)).toBe(false);
    expect(isRunning(c)).toBe(false);
  });

  it('shortName strips the .service suffix', () => {
    expect(shortName('caddy.service')).toBe('caddy');
    expect(shortName('postgresql.service')).toBe('postgresql');
    expect(shortName('weird-name')).toBe('weird-name');
  });

  it('formatLogLine composes ts + priority + message', () => {
    const line = {
      ts: '2026-01-01T00:00:00Z',
      priority: 'info' as const,
      unit: 'caddy.service',
      message: 'started',
    };
    expect(formatLogLine(line)).toBe('2026-01-01T00:00:00Z [info] started');
  });
});

describe('bridge — loaders', () => {
  it('listUnits returns the seeded units sorted by name', async () => {
    const units = await listUnits();
    expect(units.length).toBe(SEED.length);
    const names = units.map((u) => u.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('getUnit returns a known unit and null for an unknown one', async () => {
    const known = await getUnit('caddy.service');
    expect(known?.name).toBe('caddy.service');
    const missing = await getUnit('does-not-exist.service');
    expect(missing).toBeNull();
  });

  it('listLogs returns the seeded buffer for a known unit', async () => {
    const lines = await listLogs('caddy.service', 50);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.unit === 'caddy.service')).toBe(true);
  });
});

describe('bridge — dispatchAction security', () => {
  const baseCtx: DispatchContext = {
    user: makeUser(),
    ip: '127.0.0.1',
    userAgent: 'test',
    requestId: 'req_test',
    sessionId: 'sess_test',
  };

  it('accepts a non-destructive action on an allowlisted unit', async () => {
    const res = await dispatchAction(
      { action: 'start', name: 'caddy.service' },
      baseCtx,
    );
    expect(res.status).toBe('accepted');
    if (res.status === 'accepted') {
      expect(res.action).toBe('start');
      expect(res.unit.name).toBe('caddy.service');
      expect(res.exitCode).toBe(0);
    }
  });

  it('rejects an unknown op', async () => {
    const res = await dispatchAction(
      { action: 'frobnicate' as SystemdActionKind, name: 'caddy.service' },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') expect(res.code).toBe('unknown_op');
  });

  it('rejects a unit name that does not match the regex', async () => {
    const res = await dispatchAction(
      { action: 'start', name: 'bad;name unit' },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') expect(res.code).toBe('unit_name_invalid');
  });

  it('rejects an unknown unit', async () => {
    const res = await dispatchAction(
      { action: 'start', name: 'missing.service' },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') expect(res.code).toBe('unknown_unit');
  });

  it('rejects a non-allowlisted unit (e.g. unattended-upgrades)', async () => {
    const res = await dispatchAction(
      { action: 'start', name: 'unattended-upgrades.service' },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') expect(res.code).toBe('not_allowlisted');
  });

  it('returns approval_required for a destructive action without a token', async () => {
    const res = await dispatchAction(
      { action: 'restart', name: 'caddy.service' },
      baseCtx,
    );
    expect(res.status).toBe('approval_required');
    if (res.status === 'approval_required') {
      expect(res.actionHash).toMatch(/^[a-f0-9]{64}$/);
      expect(res.ttlSec).toBeGreaterThan(0);
    }
  });

  it('rejects a destructive action with a bogus approval token', async () => {
    const res = await dispatchAction(
      { action: 'restart', name: 'caddy.service' },
      {
        ...baseCtx,
        approvalToken: 'not-a-real-token',
      },
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(['approval_invalid', 'approval_expired', 'malformed']).toContain(res.code);
    }
  });
});

describe('bridge — listUnitActions', () => {
  it('projects the policy allowlist into a UI shape', () => {
    const ops = listUnitActions();
    expect(ops.length).toBeGreaterThanOrEqual(6);
    const restart = ops.find((o) => o.action === 'restart');
    expect(restart?.requiresApproval).toBe(true);
    const start = ops.find((o) => o.action === 'start');
    expect(start?.requiresApproval).toBe(false);
  });
});

// Use the alias so the unused-import rule doesn't trip.
void (null as unknown as Unit);
