// @vitest-environment node
/**
 * incus-bridge-extra.test.ts — additional coverage of the incus
 * bridge. Targets the pure helpers + dispatch rejection paths
 * that the existing bridge-dispatch.test.ts does not exercise.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let execFileMock: ReturnType<typeof vi.fn>;

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  const { promisify } = await import('node:util');
  const mockExecFile = ((...args: unknown[]) => {
    const lastArg = args[args.length - 1];
    if (typeof lastArg === 'function') {
      const cb = lastArg as (err: Error | null, stdout: string, stderr: string) => void;
      try {
        const result = execFileMock(...args);
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          (result as Promise<{ stdout: string; stderr: string }>).then(
            (v) => cb(null, v.stdout, v.stderr),
            (e) => cb(e as Error, '', ''),
          );
        } else {
          const r = result as { stdout?: string; stderr?: string } | undefined;
          cb(null, r?.stdout ?? '', r?.stderr ?? '');
        }
      } catch (e) {
        cb(e as Error, '', '');
      }
    } else {
      return execFileMock(...args);
    }
  }) as typeof actual.execFile;
  (mockExecFile as unknown as Record<string, unknown>)[promisify.custom as unknown as string] =
    (file: string, args: string[], options: Record<string, unknown>) =>
      new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
        mockExecFile(file, args, options, (err: Error | null, stdout: string, stderr: string) => {
          if (err) return reject(err);
          resolve({ stdout, stderr });
        });
      });
  return {
    ...actual,
    execFile: mockExecFile,
  };
});

describe('incus bridge — public surface + helpers', () => {
  beforeEach(() => {
    execFileMock = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('exports the full public surface', async () => {
    vi.stubEnv('CORTEX_INCUS_BRIDGE_REAL', '1');
    const mod = await import('../bridge');
    expect(typeof mod.listInstances).toBe('function');
    expect(typeof mod.getInstance).toBe('function');
    expect(typeof mod.dispatchAction).toBe('function');
    expect(typeof mod.dispatchExecNamed).toBe('function');
    expect(typeof mod.listInstanceActions).toBe('function');
    expect(Array.isArray(mod._SEED_INSTANCES)).toBe(true);
    expect(mod._DESTRUCTIVE_ACTIONS).toBeInstanceOf(Set);
  });

  it('listInstances returns the seed on the mock path', async () => {
    const mod = await import('../bridge');
    const list = await mod.listInstances();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('getInstance returns the instance by name', async () => {
    const mod = await import('../bridge');
    const i = await mod.getInstance(_SEED_FIRST(mod).name);
    expect(i).not.toBeNull();
  });

  it('getInstance returns null for an unknown name', async () => {
    const mod = await import('../bridge');
    const i = await mod.getInstance('does-not-exist');
    expect(i).toBeNull();
  });

  it('listInstanceLogs returns the seed logs for a known instance', async () => {
    const mod = await import('../bridge');
    const logs = await mod.listInstanceLogs(_SEED_FIRST(mod).name, 10);
    expect(Array.isArray(logs)).toBe(true);
  });

  it('listInstanceLogs returns [] for an unknown instance', async () => {
    const mod = await import('../bridge');
    const logs = await mod.listInstanceLogs('does-not-exist', 10);
    expect(logs).toEqual([]);
  });

  it('EXEC_NAMED_OPS is the set of allowlisted exec-named ops', async () => {
    const mod = await import('../bridge');
    expect(mod.EXEC_NAMED_OPS).toBeInstanceOf(Set);
    expect(mod.EXEC_NAMED_OPS.size).toBeGreaterThan(0);
  });
});

function _SEED_FIRST(mod: { _SEED_INSTANCES: ReadonlyArray<{ name: string }> }): { name: string } {
  const first = mod._SEED_INSTANCES[0];
  if (!first) throw new Error('No seed instances');
  return first;
}
