/**
 * systemd-bridge.test.ts — direct coverage of the systemd
 * privilege bridge (applyAction, listUnits, getUnit, listLogs,
 * dispatchAction across all rejection paths + success).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyAction,
  listUnits,
  getUnit,
  listLogs,
  listUnitActions,
  dispatchAction,
  _getMockExecutorForTests,
  _resetSystemdBridgeForTests,
  _SEED_UNITS,
} from '../bridge';
import { resetAudit } from '../../audit';
import { _resetAllBuckets } from '../../rate-limit';
import {
  makeFakeUser,
} from '../../test-utils';
import { actionHashFor } from '../../approval';

beforeEach(() => {
  _resetSystemdBridgeForTests();
  resetAudit();
  _resetAllBuckets();
});

const user = makeFakeUser({ is_admin: true, groupMemberships: ['cortexos-admin'] });

const baseCtx = {
  user,
  ip: '127.0.0.1',
  userAgent: 'test/1.0',
  requestId: 'req-test',
  sessionId: 'sess-test',
};

describe('systemd bridge — applyAction', () => {
  it.each([
    ['start', 'active', 'running'],
    ['stop', 'inactive', 'dead'],
    ['restart', 'active', 'running'],
    ['reload', 'active', 'running'],
    ['enable', 'active', 'running'],
    ['disable', 'active', 'running'],
    ['status', 'active', 'running'],
    ['list-units', 'active', 'running'],
  ] as const)('applyAction(%s) sets the expected state', (action, active, sub) => {
    const seed = _SEED_UNITS[0]!;
    const out = applyAction(seed, action);
    expect(out.active).toBe(active);
    expect(out.sub).toBe(sub);
  });

  it('enable / disable toggle the enabled flag', () => {
    const seed = _SEED_UNITS[0]!;
    const enabled = applyAction(seed, 'enable');
    expect(enabled.enabled).toBe(true);
    const disabled = applyAction(seed, 'disable');
    expect(disabled.enabled).toBe(false);
  });
});

describe('systemd bridge — listUnits / getUnit / listLogs', () => {
  it('listUnits returns the seed by default', async () => {
    const list = await listUnits();
    expect(list.length).toBe(_SEED_UNITS.length);
  });

  it('getUnit returns the unit by name', async () => {
    const u = await getUnit('caddy.service');
    expect(u?.name).toBe('caddy.service');
  });

  it('getUnit returns null for an unknown name', async () => {
    const u = await getUnit('does-not-exist.service');
    expect(u).toBeNull();
  });

  it('listLogs returns at most `limit` lines, newest-last', async () => {
    const mock = _getMockExecutorForTests();
    // Snapshot before so we can compute the delta our 3 appends add.
    const before = (await listLogs('caddy.service', 100)).length;
    mock.pushLog('caddy.service', { ts: '2024-01-01T00:00:00Z', priority: 'info', message: 'a' });
    mock.pushLog('caddy.service', { ts: '2024-01-01T00:00:01Z', priority: 'info', message: 'b' });
    mock.pushLog('caddy.service', { ts: '2024-01-01T00:00:02Z', priority: 'info', message: 'c' });
    const all = await listLogs('caddy.service', 100);
    expect(all.length).toBe(before + 3);
    expect(all.slice(-3).map((l) => l.message)).toEqual(['a', 'b', 'c']);
    const last2 = await listLogs('caddy.service', 2);
    expect(last2.length).toBe(2);
    expect(last2[last2.length - 1]?.message).toBe('c');
  });

  it('listLogs returns [] for unknown unit', async () => {
    const out = await listLogs('does-not-exist.service', 10);
    expect(out).toEqual([]);
  });

  it('listUnitActions returns the recorded action log', () => {
    const actions = listUnitActions();
    expect(Array.isArray(actions)).toBe(true);
  });
});

describe('systemd bridge — dispatchAction rejection paths', () => {
  it('rejects an op that is not on the allowlist (unknown_op)', async () => {
    const res = await dispatchAction(
      { action: 'reboot' as never, name: 'caddy.service' },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.code).toBe('unknown_op');
    }
  });

  it('rejects a unit name that does not match the regex (unit_name_invalid)', async () => {
    const res = await dispatchAction(
      { action: 'start', name: '../etc/passwd' },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.code).toBe('unit_name_invalid');
    }
  });

  it('rejects an unknown unit (unknown_unit)', async () => {
    const res = await dispatchAction(
      { action: 'start', name: 'no-such-unit.service' },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.code).toBe('unknown_unit');
    }
  });

  it('destructive action without token returns approval_required', async () => {
    const res = await dispatchAction(
      { action: 'restart', name: 'caddy.service' },
      baseCtx,
    );
    expect(res.status).toBe('approval_required');
    if (res.status === 'approval_required') {
      expect(res.actionHash).toBe(actionHashFor('systemd.restart', { name: 'caddy.service' }));
      expect(res.ttlSec).toBeGreaterThan(0);
    }
  });

  it('destructive action with bogus token returns approval_invalid', async () => {
    const res = await dispatchAction(
      { action: 'restart', name: 'caddy.service' },
      { ...baseCtx, approvalToken: 'not-a-real-token' },
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(['approval_invalid', 'approval_expired', 'approval_session_mismatch', 'approval_already_used']).toContain(res.code);
    }
  });

  it('non-destructive action (start) succeeds without token', async () => {
    const res = await dispatchAction(
      { action: 'start', name: 'caddy.service' },
      baseCtx,
    );
    expect(res.status).toBe('accepted');
    if (res.status === 'accepted') {
      expect(res.unit.name).toBe('caddy.service');
      expect(res.exitCode).toBe(0);
    }
  });
});
