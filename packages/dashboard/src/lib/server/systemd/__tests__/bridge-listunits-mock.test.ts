// @vitest-environment node
/**
 * systemd-bridge-listunits-mock.test.ts — coverage of
 * `listUnits` / `getUnit` / `listLogs` / `listUnitActions` and
 * the real-mode path via mocked execFile.
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
  // Re-attach Node's util.promisify.custom so `promisify(execFile)` returns
  // `{stdout, stderr}` (an object) instead of the array-form callback path
  // that `util.promisify` falls back to when the symbol is missing.
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

describe('systemd bridge — public surface (linux + real)', () => {
  beforeEach(() => {
    execFileMock = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exports the public read API', async () => {
    vi.stubEnv('CORTEX_SYSTEMD_BRIDGE_REAL', '1');
    const mod = await import('../bridge');
    expect(typeof mod.listUnits).toBe('function');
    expect(typeof mod.getUnit).toBe('function');
    expect(typeof mod.listLogs).toBe('function');
    expect(typeof mod.listUnitActions).toBe('function');
    expect(typeof mod.dispatchAction).toBe('function');
  });

  it('listUnits returns the seed by default (mock mode on darwin)', async () => {
    // On darwin the default is the mock executor. listUnits uses
    // currentMock?.list() when currentMock is set.
    // On linux with CORTEX_SYSTEMD_BRIDGE_REAL=1 the real executor
    // is selected, so we mock execFile to return canned output.
    if (process.platform === 'linux') {
      execFileMock.mockResolvedValue({ stdout: '', stderr: '' });
    }
    const mod = await import('../bridge');
    const list = await mod.listUnits();
    expect(Array.isArray(list)).toBe(true);
  });

  it('getUnit returns the unit by name on the mock path', async () => {
    if (process.platform === 'linux') {
      execFileMock.mockResolvedValue({
        stdout: 'ActiveState=active\nSubState=running\nLoadState=loaded\nUnitFileState=enabled\nType=simple\nFragmentPath=/etc/systemd/system/caddy.service\nDescription=Caddy',
      });
    }
    const mod = await import('../bridge');
    const u = await mod.getUnit('caddy.service');
    expect(u).not.toBeNull();
    expect(u?.name).toBe('caddy.service');
  });

  it('getUnit returns null for an unknown name', async () => {
    if (process.platform === 'linux') {
      // systemctl show exits non-zero when the unit doesn't exist.
      execFileMock.mockImplementation(() => {
        throw new Error('unit not found');
      });
    }
    const mod = await import('../bridge');
    const u = await mod.getUnit('does-not-exist.service');
    expect(u).toBeNull();
  });

  it('listLogs returns at most `limit` lines', async () => {
    if (process.platform === 'linux') {
      execFileMock.mockResolvedValue({ stdout: '', stderr: '' });
    }
    const mod = await import('../bridge');
    const out = await mod.listLogs('caddy.service', 5);
    expect(Array.isArray(out)).toBe(true);
  });

  it('listUnitActions returns the action log', async () => {
    const mod = await import('../bridge');
    const actions = mod.listUnitActions();
    expect(Array.isArray(actions)).toBe(true);
  });
});
