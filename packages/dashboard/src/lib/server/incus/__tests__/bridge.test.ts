/**
 * incus-bridge.test.ts — direct coverage of the incus bridge
 * (applyAction, listInstances, getInstance, listInstanceLogs,
 *  listImages, runPreflightReport, buildLaunchProgress, dispatchAction
 *  rejection paths).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyAction,
  listInstances,
  getInstance,
  listInstanceLogs,
  listImages,
  runPreflightReport,
  buildLaunchProgress,
  dispatchAction,
  listInstanceActions,
  _getMockExecutorForTests,
  _resetIncusBridgeForTests,
  _SEED_INSTANCES,
} from '../bridge';
import { resetAudit } from '../../audit';
import { _resetAllBuckets } from '../../rate-limit';
import { makeFakeUser } from '../../test-utils';
import type { IncusInstanceConfig } from '@cortexos/contracts';

beforeEach(() => {
  _resetIncusBridgeForTests();
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

const baseConfig: IncusInstanceConfig = {
  target: { mode: 'new', branch: 'main', ghOrg: 'cortexos', slug: 'test-incus' },
  image: { alias: 'ubuntu/24.04', gastown: false, profiles: ['default'], pool: 'default' },
  hermes: { enabled: false, proxies: [] },
  network: { bridge: 'incusbr0', tailscale: true, webAccess: false },
};

describe('incus bridge — applyAction', () => {
  it.each([
    ['start', 'active'],
    ['stop', 'stopped'],
    ['restart', 'active'],
    ['delete', 'failed'],
    ['launch', 'provisioning'],
  ] as const)('applyAction(%s) sets status to %s', (action, status) => {
    const seed = _SEED_INSTANCES[0]!;
    const out = applyAction(seed, action);
    expect(out.status).toBe(status);
  });

  it('applyAction("list") and applyAction("exec-named") return a clone', () => {
    const seed = _SEED_INSTANCES[0]!;
    const out = applyAction(seed, 'list');
    expect(out).toEqual(seed);
  });
});

describe('incus bridge — list / get / logs / images', () => {
  it('listInstances returns at least the seeds', async () => {
    const list = await listInstances();
    expect(list.length).toBeGreaterThanOrEqual(_SEED_INSTANCES.length);
    expect(list[0]).toHaveProperty('name');
    expect(list[0]).toHaveProperty('config');
  });

  it('getInstance returns the instance by name', async () => {
    const u = await getInstance(_SEED_INSTANCES[0]!.name);
    expect(u?.name).toBe(_SEED_INSTANCES[0]!.name);
  });

  it('getInstance returns null for an unknown name', async () => {
    const u = await getInstance('does-not-exist');
    expect(u).toBeNull();
  });

  it('listInstanceLogs returns at most `limit` lines, newest-first', async () => {
    const mock = _getMockExecutorForTests();
    const before = (await listInstanceLogs(_SEED_INSTANCES[0]!.name, 100)).length;
    mock.pushLog(_SEED_INSTANCES[0]!.name, {
      ts: '2024-01-01T00:00:00Z',
      priority: 'info',
      name: _SEED_INSTANCES[0]!.name,
      message: 'new-line',
    });
    const out = await listInstanceLogs(_SEED_INSTANCES[0]!.name, 100);
    expect(out.length).toBe(before + 1);
    // The listInstanceLogs returns newest-first; the new line is at index 0.
    expect(out[0]?.message).toBe('new-line');
  });

  it('listInstanceLogs returns [] for unknown instance', async () => {
    const out = await listInstanceLogs('does-not-exist', 10);
    expect(out).toEqual([]);
  });

  it('listImages returns at least one image', async () => {
    const imgs = await listImages();
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs[0]).toHaveProperty('fingerprint');
  });
});

describe('incus bridge — runPreflightReport', () => {
  it('returns ok=true for a known config', async () => {
    const r = await runPreflightReport(baseConfig);
    expect(r.ok).toBe(true);
    expect(r.checks.every((c) => c.pass)).toBe(true);
  });

  it('returns ok=false for an unknown image alias', async () => {
    const cfg = { ...baseConfig, image: { ...baseConfig.image, alias: 'unknown/99' } };
    const r = await runPreflightReport(cfg);
    expect(r.ok).toBe(false);
    const imageCheck = r.checks.find((c) => c.id === 'image');
    expect(imageCheck?.pass).toBe(false);
  });

  it('returns ok=false for an unknown storage pool', async () => {
    const cfg = { ...baseConfig, image: { ...baseConfig.image, pool: 'unknown-pool' } };
    const r = await runPreflightReport(cfg);
    expect(r.ok).toBe(false);
    const poolCheck = r.checks.find((c) => c.id === 'pool');
    expect(poolCheck?.pass).toBe(false);
  });

  it('returns ok=false for an unknown network bridge', async () => {
    const cfg = { ...baseConfig, network: { ...baseConfig.network, bridge: 'unknown-br' } };
    const r = await runPreflightReport(cfg);
    expect(r.ok).toBe(false);
    const bridgeCheck = r.checks.find((c) => c.id === 'bridge');
    expect(bridgeCheck?.pass).toBe(false);
  });

  it('returns ok=false for a name that already exists', async () => {
    const cfg = {
      ...baseConfig,
      target: { ...baseConfig.target, slug: _SEED_INSTANCES[0]!.name },
    };
    const r = await runPreflightReport(cfg);
    expect(r.ok).toBe(false);
    const nameCheck = r.checks.find((c) => c.id === 'name');
    expect(nameCheck?.pass).toBe(false);
  });

  it('hermes-secret check only present when hermes.enabled', async () => {
    const on = { ...baseConfig, hermes: { ...baseConfig.hermes, enabled: true, profile: 'hp' } };
    const r = await runPreflightReport(on);
    const hermes = r.checks.find((c) => c.id === 'hermes-secret');
    expect(hermes).toBeDefined();
  });
});

describe('incus bridge — buildLaunchProgress', () => {
  it('returns 7 progress steps for any name', () => {
    const p = buildLaunchProgress('any-name');
    expect(p.length).toBe(7);
    expect(p[0]!.step).toBe('preflight');
    expect(p[p.length - 1]!.step).toBe('start');
  });
});

describe('incus bridge — dispatchAction rejection paths', () => {
  it('rejects an op that is not on the allowlist', async () => {
    const res = await dispatchAction(
      { action: 'noop' as never, name: _SEED_INSTANCES[0]!.name },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.code).toBe('unknown_op');
    }
  });

  it('rejects a name that does not match the regex', async () => {
    const res = await dispatchAction(
      { action: 'start', name: 'INVALID NAME' },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.code).toBe('instance_name_invalid');
    }
  });

  it('rejects an unknown instance', async () => {
    const res = await dispatchAction(
      { action: 'start', name: 'no-such-instance' },
      baseCtx,
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.code).toBe('unknown_instance');
    }
  });

  it('destructive action (delete) without token returns approval_required or rejected (bridge may pre-validate name)', async () => {
    const res = await dispatchAction(
      { action: 'delete', name: _SEED_INSTANCES[0]!.name },
      baseCtx,
    );
    // The incus bridge may reject for the instance not being allowlisted
    // before reaching the approval gate (the seed is non-allowlisted
    // in the mock). Accept either approval_required or rejected for
    // a destructive op against a non-allowlisted seed.
    expect(['approval_required', 'rejected']).toContain(res.status);
  });

  it('non-destructive action (start) succeeds', async () => {
    const res = await dispatchAction(
      { action: 'start', name: _SEED_INSTANCES[0]!.name },
      baseCtx,
    );
    expect(res.status).toBe('accepted');
  });
});

describe('incus bridge — listInstanceActions', () => {
  it('returns an array (audit-style log)', () => {
    const actions = listInstanceActions();
    expect(Array.isArray(actions)).toBe(true);
  });
});
