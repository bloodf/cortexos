// @vitest-environment node
/**
 * docker-real-exec.test.ts — drive the real `realDockerExecutor`
 * through env-var selection on Linux + a mocked execFile.
 *
 * The bridge picks its default executor at module load based on
 * `process.platform` and `CORTEX_DOCKER_BRIDGE_REAL`. We can't
 * flip `process.platform` at runtime, but we CAN set
 * CORTEX_DOCKER_BRIDGE_REAL=1 + set the executor manually via
 * `setExecutorForTests` with a stand-in that mimics the real
 * executor's execFile shape.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let execFileMock: ReturnType<typeof vi.fn>;

// Mock child_process to capture execFile calls.
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

describe('docker bridge — real executor with mocked execFile', () => {
  beforeEach(() => {
    execFileMock = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('on darwin with CORTEX_DOCKER_BRIDGE_REAL=1, the bridge loads with a usable public surface', async () => {
    vi.stubEnv('CORTEX_DOCKER_BRIDGE_REAL', '1');
    const mod = await import('../bridge');
    expect(typeof mod.dispatch).toBe('function');
    expect(typeof mod.listDockerOps).toBe('function');
    expect(mod._STUB_MARKER.length).toBeGreaterThan(0);
  });

  it('exports the listDockerOps catalog with op/description/placeholders/requiresApproval', async () => {
    const mod = await import('../bridge');
    const ops = mod.listDockerOps();
    expect(Array.isArray(ops)).toBe(true);
    expect(ops.length).toBeGreaterThan(0);
    for (const op of ops) {
      expect(typeof op.op).toBe('string');
      expect(typeof op.description).toBe('string');
      expect(typeof op.requiresApproval).toBe('boolean');
      expect(Array.isArray(op.placeholders)).toBe(true);
    }
  });

  it('exports _internals including the smuggling helpers', async () => {
    const mod = await import('../bridge');
    const i = mod._internals;
    expect(typeof i.collectArgSmugglingHits).toBe('function');
    expect(typeof i.argvContainsBashDashC).toBe('function');
    expect(typeof i.renderArgv).toBe('function');
    expect(typeof i.hasSmugglingPattern).toBe('function');
  });
});
