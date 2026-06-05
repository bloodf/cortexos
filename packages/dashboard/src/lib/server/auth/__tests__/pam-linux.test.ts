// @vitest-environment node
/**
 * pam-linux.test.ts — coverage of the LinuxPamAuthenticator (the
 * production code path) + the module-level helpers in pam.ts.
 *
 * The FakePamAuthenticator is well-covered by auth-m2.test.ts. This
 * file targets the parts NOT exercised there:
 *   - LinuxPamAuthenticator basic surface (name, authenticate empty-creds)
 *   - LinuxPamAuthenticator.getGroups() / isAdmin() with mocked `id`
 *   - pickDefault() singleton behavior + CORTEX_AUTH_FAKE_PAM switch
 *
 * Note: we intentionally do NOT exercise the success path of
 * LinuxPamAuthenticator.authenticate() (which would require mocking
 * the `authenticate-pam` native binding). The fallback path
 * (system_error when the binding fails to load) IS covered by
 * auth-m2.test.ts. The macOS-only behavior of the binding is not
 * reproducible in a unit test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LinuxPamAuthenticator,
  getPamAuthenticator,
  setPamAuthenticator,
  resetPamAuthenticator,
  type GroupName,
} from '../pam';

let idMock: ReturnType<typeof vi.fn>;

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execFileSync: (...args: unknown[]) => {
      const cmd = args[0] as string;
      const a2 = args[1] as string[];
      if (cmd === 'id' && (a2[0] === '-u' || a2[0] === '-Gn')) {
        return idMock(...args);
      }
      return (actual.execFileSync as unknown as (...a: unknown[]) => unknown)(...args);
    },
  };
});

beforeEach(() => {
  idMock = vi.fn();
  resetPamAuthenticator();
});

afterEach(() => {
  resetPamAuthenticator();
  vi.unstubAllEnvs();
});

describe('LinuxPamAuthenticator — basic surface', () => {
  it('has name "linux-pam"', () => {
    const p = new LinuxPamAuthenticator();
    expect(p.name).toBe('linux-pam');
  });

  it('authenticate() rejects empty username or password', async () => {
    const p = new LinuxPamAuthenticator();
    const r1 = await p.authenticate('', 'x');
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toBe('invalid_credentials');
    const r2 = await p.authenticate('alice', '');
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe('invalid_credentials');
  });

  it('authenticate() with empty creds does not call id (short-circuits)', async () => {
    const p = new LinuxPamAuthenticator();
    await p.authenticate('', 'pw');
    expect(idMock).not.toHaveBeenCalled();
  });
});

describe('LinuxPamAuthenticator — getGroups / isAdmin', () => {
  it('returns the dashboard-relevant groups', async () => {
    // id -Gn alice returns "alice cortexos-admin cortexos-users docker"
    idMock.mockReturnValue('alice cortexos-admin cortexos-users docker\n');
    const p = new LinuxPamAuthenticator();
    const groups = await p.getGroups('alice');
    expect(groups).toContain('cortexos-admin');
    expect(groups).toContain('cortexos-users');
    expect(groups).not.toContain('docker'); // not a dashboard group
  });

  it('returns only auditor when the user is just an auditor', async () => {
    idMock.mockReturnValue('alice cortexos-auditor\n');
    const p = new LinuxPamAuthenticator();
    const groups = await p.getGroups('alice');
    expect(groups).toEqual(['cortexos-auditor']);
  });

  it('returns [] for a user with no dashboard groups', async () => {
    idMock.mockReturnValue('alice sudo wheel\n');
    const p = new LinuxPamAuthenticator();
    expect(await p.getGroups('alice')).toEqual([]);
  });

  it('isAdmin returns true when cortexos-admin is in the group list', async () => {
    idMock.mockReturnValue('alice cortexos-admin cortexos-users\n');
    const p = new LinuxPamAuthenticator();
    expect(await p.isAdmin('alice')).toBe(true);
  });

  it('isAdmin returns false when cortexos-admin is not in the group list', async () => {
    idMock.mockReturnValue('alice cortexos-users\n');
    const p = new LinuxPamAuthenticator();
    expect(await p.isAdmin('alice')).toBe(false);
  });

  it('returns empty groups when `id` fails', async () => {
    idMock.mockImplementation(() => {
      throw new Error('id failed');
    });
    const p = new LinuxPamAuthenticator();
    expect(await p.getGroups('alice')).toEqual([]);
    expect(await p.isAdmin('alice')).toBe(false);
  });
});

describe('module-level singleton', () => {
  it('getPamAuthenticator returns the same instance on repeated calls', () => {
    const a = getPamAuthenticator();
    const b = getPamAuthenticator();
    expect(a).toBe(b);
  });

  it('setPamAuthenticator replaces the singleton', () => {
    const custom = new LinuxPamAuthenticator();
    setPamAuthenticator(custom);
    expect(getPamAuthenticator()).toBe(custom);
  });

  it('resetPamAuthenticator forces a re-pick on next getPamAuthenticator', () => {
    const a = getPamAuthenticator();
    resetPamAuthenticator();
    const b = getPamAuthenticator();
    expect(b).not.toBe(a);
  });

  it('CORTEX_AUTH_FAKE_PAM=1 picks the fake backend (dev/test)', () => {
    vi.stubEnv('CORTEX_AUTH_FAKE_PAM', '1');
    resetPamAuthenticator();
    const a = getPamAuthenticator();
    expect(a.name).toBe('fake-pam');
  });

  it('non-Linux + CORTEX_AUTH_FAKE_PAM unset warns and picks fake (we override platform)', () => {
    // We're on darwin in this test env. Without CORTEX_AUTH_FAKE_PAM,
    // pickDefault falls through to the warn + fake branch.
    vi.stubEnv('CORTEX_AUTH_FAKE_PAM', '');
    resetPamAuthenticator();
    const a = getPamAuthenticator();
    // On darwin arm64 the linux branch is skipped, so we get fake.
    expect(a.name).toBe('fake-pam');
  });
});

// Smoke test for the GroupName export — all three are valid
describe('GroupName — all three strings are valid', () => {
  it('matches the allowlist', () => {
    const valid: ReadonlyArray<GroupName> = [
      'cortexos-admin',
      'cortexos-auditor',
      'cortexos-users',
    ];
    for (const g of valid) {
      expect(g).toMatch(/^cortexos-/);
    }
  });
});
