import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticatePam: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock('../pam', () => ({
  authenticatePam: mocks.authenticatePam,
}));

vi.mock('node:child_process', () => ({
  default: { execFile: mocks.execFile },
  execFile: mocks.execFile,
}));

vi.mock('../db/admin', () => ({
  getOrCreatePamUser: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getSessionByToken: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

import {
  generateSessionToken,
  authenticateUser,
  checkGroupMembership,
  createUserSession,
} from '../auth';
import { getOrCreatePamUser, createSession } from '../db/admin';

describe('auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatePam.mockResolvedValue(undefined);
    mocks.execFile.mockImplementation((_cmd, _args, _options, cb) => cb(null, 'cortexos sudo\n', ''));
  });

  it('generateSessionToken returns 64-char hex', () => {
    const tok1 = generateSessionToken();
    const tok2 = generateSessionToken();
    expect(tok1).toHaveLength(64);
    expect(tok2).toHaveLength(64);
    expect(tok1).not.toBe(tok2);
    expect(/^[a-f0-9]+$/.test(tok1)).toBe(true);
  });

  it('checkGroupMembership returns true for matching group', async () => {
    await expect(checkGroupMembership('admin', ['sudo'])).resolves.toBe(true);
    expect(mocks.execFile).toHaveBeenCalledWith('id', ['-Gn', 'admin'], { timeout: 2000 }, expect.any(Function));
  });

  it('checkGroupMembership returns false on id failure', async () => {
    mocks.execFile.mockImplementation((_cmd, _args, _options, cb) => cb(new Error('missing'), '', ''));
    await expect(checkGroupMembership('missing', ['sudo'])).resolves.toBe(false);
  });

  it('authenticateUser returns PAM user with admin flag on valid credentials', async () => {
    (getOrCreatePamUser as any).mockResolvedValue({
      id: 1,
      username: 'admin',
      created_at: new Date(),
    });
    const result = await authenticateUser(' admin ', 'pass');
    expect(mocks.authenticatePam).toHaveBeenCalledWith('admin', 'pass');
    expect(getOrCreatePamUser).toHaveBeenCalledWith('admin');
    expect(result?.username).toBe('admin');
    expect(result?.is_admin).toBe(true);
  });

  it('authenticateUser returns non-admin user when group check misses', async () => {
    mocks.execFile.mockImplementation((_cmd, _args, _options, cb) => cb(null, 'users\n', ''));
    (getOrCreatePamUser as any).mockResolvedValue({
      id: 2,
      username: 'operator',
      created_at: new Date(),
    });
    const result = await authenticateUser('operator', 'pass');
    expect(result?.is_admin).toBe(false);
  });

  it('authenticateUser returns null on PAM failure', async () => {
    mocks.authenticatePam.mockRejectedValue(new Error('denied'));
    const result = await authenticateUser('admin', 'wrong');
    expect(result).toBeNull();
    expect(getOrCreatePamUser).not.toHaveBeenCalled();
  });

  it('authenticateUser returns null on blank input', async () => {
    await expect(authenticateUser(' ', 'pass')).resolves.toBeNull();
    await expect(authenticateUser('admin', '')).resolves.toBeNull();
    expect(mocks.authenticatePam).not.toHaveBeenCalled();
  });

  it('createUserSession stores is_admin in session', async () => {
    (createSession as any).mockResolvedValue({});
    const result = await createUserSession(1, true);
    expect(result.token).toHaveLength(64);
    expect(createSession).toHaveBeenCalledWith(1, result.token, result.expiresAt, true);
  });
});
