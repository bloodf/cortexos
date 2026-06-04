/**
 * adapter.test.ts — view-model helpers + bridge defaults + security paths.
 *
 * The bridge is the security-critical seam (PB-5 + PB-4 + SR-019).
 * These tests exercise:
 *   - view-model helpers (filterByStatus, filterByType, filterByQuery,
 *     countByStatus, isActiveStatus, isPendingStatus, isLiveStatus,
 *     isRunning, formatResources, stateVariant, requiresApproval)
 *   - the bridge's default seed + loaders (read-only paths)
 *   - the bridge's `dispatchAction` security paths (admin gate,
 *     approval gate, regex, allowlist, delete confirmation)
 *   - the bridge's `dispatchExecNamed` (PB-4) — admin + closed
 *     allowlist + arg-smuggling scan + `bash -c` belt-and-braces
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  filterByQuery,
  filterByStatus,
  filterByType,
  countByStatus,
  isActiveStatus,
  isPendingStatus,
  isLiveStatus,
  isRunning,
  formatResources,
  stateVariant,
  requiresApproval,
  DESTRUCTIVE_ACTIONS,
} from '../adapter';
import {
  _getMockExecutorForTests,
  _resetIncusBridgeForTests,
  listInstances,
  getInstance,
  listInstanceLogs,
  listInstanceActions,
  listImages,
  runPreflightReport,
  dispatchAction,
  dispatchExecNamed,
  _DESTRUCTIVE_ACTIONS,
  EXEC_NAMED_OPS,
  type DispatchContext,
} from '$lib/server/incus/bridge';
import type { User } from '$lib/server/entities';

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
  _resetIncusBridgeForTests();
});

describe('adapter — view-model helpers', () => {
  const SEED = _getMockExecutorForTests().list();

  it('filterByStatus splits the seed by status', () => {
    const all = filterByStatus(SEED, 'all');
    expect(all.length).toBe(SEED.length);
    const active = filterByStatus(SEED, 'active');
    expect(active.every((i) => i.status === 'active')).toBe(true);
    const failed = filterByStatus(SEED, 'failed');
    expect(failed.every((i) => i.status === 'failed')).toBe(true);
  });

  it('filterByType filters by container|vm', () => {
    const containers = filterByType(SEED, 'container');
    const vms = filterByType(SEED, 'vm');
    expect(containers.every((i) => i.type === 'container')).toBe(true);
    expect(vms.every((i) => i.type === 'vm')).toBe(true);
    expect(containers.length + vms.length).toBe(SEED.length);
  });

  it('filterByQuery matches name or image substring (case-insensitive)', () => {
    const all = filterByQuery(SEED, '');
    expect(all.length).toBe(SEED.length);
    const paperclip = filterByQuery(SEED, 'PAPER');
    expect(paperclip.some((i) => i.name === 'paperclip-relay')).toBe(true);
    const ubuntu = filterByQuery(SEED, 'ubuntu');
    expect(ubuntu.every((i) => i.image.includes('ubuntu'))).toBe(true);
  });

  it('countByStatus matches the seed counts', () => {
    const counts = countByStatus(SEED);
    expect(counts.total).toBe(SEED.length);
    expect(counts.active).toBe(filterByStatus(SEED, 'active').length + filterByStatus(SEED, 'running').length);
  });

  it('isActiveStatus / isPendingStatus / isLiveStatus partition the states', () => {
    expect(isActiveStatus('active')).toBe(true);
    expect(isActiveStatus('running')).toBe(true);
    expect(isActiveStatus('failed')).toBe(false);
    expect(isPendingStatus('draft')).toBe(true);
    expect(isPendingStatus('validated')).toBe(true);
    expect(isPendingStatus('provisioning')).toBe(true);
    expect(isPendingStatus('active')).toBe(false);
    expect(isLiveStatus('running')).toBe(true);
    expect(isLiveStatus('stopped')).toBe(true);
    expect(isLiveStatus('draft')).toBe(false);
  });

  it('isRunning + formatResources', () => {
    const active = SEED[0]!;
    expect(isRunning(active)).toBe(true);
    const r = formatResources(active);
    expect(r.cpu).toContain('vCPU');
    expect(r.memory).toMatch(/MiB|GiB/);
    const empty = { ...active, cpu: null, memory: null };
    const r2 = formatResources(empty);
    expect(r2.cpu).toBe('—');
    expect(r2.memory).toBe('—');
  });

  it('stateVariant maps every state to a valid variant', () => {
    for (const s of ['draft', 'validated', 'provisioning', 'active', 'failed', 'running', 'stopped', 'frozen', 'error'] as const) {
      const v = stateVariant(s);
      expect(['success', 'warning', 'destructive', 'info', 'secondary', 'outline']).toContain(v);
    }
  });

  it('DESTRUCTIVE_ACTIONS matches the bridge + requiresApproval', () => {
    expect(DESTRUCTIVE_ACTIONS.has('stop')).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has('restart')).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has('delete')).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has('start')).toBe(false);
    expect(requiresApproval('stop')).toBe(true);
    expect(requiresApproval('start')).toBe(false);
    expect(_DESTRUCTIVE_ACTIONS.has('stop')).toBe(true);
  });
});

describe('bridge — loaders', () => {
  it('listInstances returns the seeded instances sorted by name', async () => {
    const instances = await listInstances();
    const names = instances.map((i) => i.name);
    expect(names).toEqual([...names].sort());
    expect(instances.length).toBeGreaterThanOrEqual(3);
  });

  it('getInstance returns a known instance and null for an unknown one', async () => {
    const known = await getInstance('hermes-canary');
    expect(known?.name).toBe('hermes-canary');
    const missing = await getInstance('does-not-exist');
    expect(missing).toBeNull();
  });

  it('listInstanceLogs returns the seeded buffer newest-first', async () => {
    const lines = await listInstanceLogs('hermes-canary', 50);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.name === 'hermes-canary')).toBe(true);
  });

  it('listImages returns the three seeded images', async () => {
    const images = await listImages();
    expect(images.length).toBe(3);
    expect(images.every((i) => i.fingerprint.length >= 12)).toBe(true);
  });

  it('listInstanceActions projects the policy allowlist into a UI shape', () => {
    const actions = listInstanceActions();
    const restart = actions.find((a) => a.action === 'restart');
    expect(restart?.requiresApproval).toBe(true);
    const start = actions.find((a) => a.action === 'start');
    expect(start?.requiresApproval).toBe(false);
  });
});

describe('bridge — runPreflightReport (M2 deterministic)', () => {
  it('returns ok=true for a known alias + pool + bridge', async () => {
    const report = await runPreflightReport({
      target: { mode: 'new', branch: 'main', ghOrg: 'cortexos', slug: 'fresh-canary' },
      image: { alias: 'ubuntu/24.04', gastown: false, profiles: ['default'], pool: 'default' },
      hermes: { enabled: false, proxies: [] },
      network: { bridge: 'incusbr0', tailscale: true, webAccess: false },
    });
    expect(report.ok).toBe(true);
    expect(report.checks.length).toBeGreaterThanOrEqual(4);
  });

  it('returns ok=false for an unknown image alias', async () => {
    const report = await runPreflightReport({
      target: { mode: 'new', branch: 'main', ghOrg: 'cortexos', slug: 'fresh-canary' },
      image: { alias: 'missing/image', gastown: false, profiles: ['default'], pool: 'default' },
      hermes: { enabled: false, proxies: [] },
      network: { bridge: 'incusbr0', tailscale: true, webAccess: false },
    });
    expect(report.ok).toBe(false);
    const imageCheck = report.checks.find((c) => c.id === 'image');
    expect(imageCheck?.pass).toBe(false);
  });

  it('returns ok=false for a name conflict', async () => {
    const report = await runPreflightReport({
      target: { mode: 'new', branch: 'main', ghOrg: 'cortexos', slug: 'hermes-canary' },
      image: { alias: 'ubuntu/24.04', gastown: false, profiles: ['default'], pool: 'default' },
      hermes: { enabled: false, proxies: [] },
      network: { bridge: 'incusbr0', tailscale: true, webAccess: false },
    });
    expect(report.ok).toBe(false);
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

  it('accepts start on an allowlisted instance', async () => {
    const res = await dispatchAction({ action: 'start', name: 'archive-cold' }, baseCtx);
    expect(res.status).toBe('accepted');
    if (res.status === 'accepted') {
      expect(res.action).toBe('start');
      expect(res.name).toBe('archive-cold');
    }
  });

  it('rejects an unknown op', async () => {
    const res = await dispatchAction(
      { action: 'frobnicate' as never, name: 'hermes-canary' },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') expect(res.code).toBe('unknown_op');
  });

  it('rejects an instance name that does not match the regex', async () => {
    const res = await dispatchAction(
      { action: 'start', name: 'Bad;Name' },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') expect(res.code).toBe('instance_name_invalid');
  });

  it('rejects an unknown instance', async () => {
    const res = await dispatchAction({ action: 'start', name: 'missing' }, baseCtx);
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') expect(res.code).toBe('unknown_instance');
  });

  it('returns approval_required for a destructive action without a token', async () => {
    const res = await dispatchAction({ action: 'stop', name: 'hermes-canary' }, baseCtx);
    expect(res.status).toBe('approval_required');
    if (res.status === 'approval_required') {
      expect(res.actionHash).toMatch(/^[a-f0-9]{64}$/);
      expect(res.ttlSec).toBeGreaterThan(0);
    }
  });

  it('rejects a destructive action with a bogus approval token', async () => {
    const res = await dispatchAction(
      { action: 'stop', name: 'hermes-canary' },
      { ...baseCtx, approvalToken: 'not-a-real-token' },
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(['approval_invalid', 'approval_expired', 'approval_already_used']).toContain(res.code);
    }
  });

  it('rejects a delete action without the typed confirmation phrase', async () => {
    const res = await dispatchAction(
      { action: 'delete', name: 'archive-cold' },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') expect(res.code).toBe('confirmation_required');
  });

  it('rejects a delete action with a wrong confirmation phrase', async () => {
    const res = await dispatchAction(
      { action: 'delete', name: 'archive-cold', confirmation: 'yes' },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') expect(res.code).toBe('confirmation_required');
  });
});

describe('bridge — dispatchExecNamed (PB-4)', () => {
  const baseCtx = {
    user: makeUser(),
    ip: '127.0.0.1',
    userAgent: 'test',
    requestId: 'req_test',
  };

  it('accepts a closed-allowlist op (term.ps)', async () => {
    const res = await dispatchExecNamed('hermes-canary', { op: 'term.ps', args: {} }, baseCtx);
    expect(res.status).toBe('accepted');
    if (res.status === 'accepted') expect(res.op).toBe('term.ps');
  });

  it('accepts term.ls with a path arg', async () => {
    const res = await dispatchExecNamed(
      'hermes-canary',
      { op: 'term.ls', args: { path: '/var/log' } },
      baseCtx,
    );
    expect(res.status).toBe('accepted');
  });

  it('rejects an op that is not on the closed allowlist', async () => {
    const res = await dispatchExecNamed(
      'hermes-canary',
      { op: 'term.bash_c' as never, args: {} },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') expect(res.code).toBe('unknown_op');
  });

  it('rejects an unknown instance', async () => {
    const res = await dispatchExecNamed(
      'missing',
      { op: 'term.ps', args: {} },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') expect(res.code).toBe('unknown_instance');
  });

  it('rejects arg-smuggling (T-104): pipe in path', async () => {
    const res = await dispatchExecNamed(
      'hermes-canary',
      { op: 'term.ls', args: { path: '/etc | rm -rf /' } },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(['arg_smuggling', 'argv_bash_c']).toContain(res.code);
    }
  });

  it('rejects arg-smuggling: literal `bash -c` in path', async () => {
    const res = await dispatchExecNamed(
      'hermes-canary',
      { op: 'term.cat', args: { path: '$(bash -c id)' } },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(['arg_smuggling', 'argv_bash_c']).toContain(res.code);
    }
  });

  it('EXEC_NAMED_OPS contains the 6 expected ops', () => {
    expect(EXEC_NAMED_OPS.size).toBe(6);
    expect(EXEC_NAMED_OPS.has('term.ps')).toBe(true);
    expect(EXEC_NAMED_OPS.has('term.df')).toBe(true);
    expect(EXEC_NAMED_OPS.has('term.ls')).toBe(true);
    expect(EXEC_NAMED_OPS.has('term.cat')).toBe(true);
    expect(EXEC_NAMED_OPS.has('term.tail_log')).toBe(true);
    expect(EXEC_NAMED_OPS.has('term.exec_named')).toBe(true);
  });
});
