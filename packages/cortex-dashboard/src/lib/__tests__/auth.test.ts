import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../pam', () => ({
  authenticatePam: vi.fn(),
}));

vi.mock('../db/admin', () => ({
  getOrCreatePamUser: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getSessionByToken: vi.fn(),
}));

vi.mock('node:child_process', () => {
  const execFile = vi.fn(
    (_cmd: string, _args: string[], _opts: unknown, cb: any) => cb(null, ''),
  );
  return { execFile, default: { execFile } };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

import {
  generateSessionToken,
  authenticateUser,
} from '../auth';
import { authenticatePam } from '../pam';
import { getOrCreatePamUser } from '../db/admin';

describe('auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generateSessionToken returns 64-char hex', () => {
    const tok1 = generateSessionToken();
    const tok2 = generateSessionToken();
    expect(tok1).toHaveLength(64);
    expect(tok2).toHaveLength(64);
    expect(tok1).not.toBe(tok2);
    expect(/^[a-f0-9]+$/.test(tok1)).toBe(true);
  });

  it('authenticateUser returns user when PAM accepts', async () => {
    (authenticatePam as any).mockResolvedValue(undefined);
    (getOrCreatePamUser as any).mockResolvedValue({
      id: 1,
      username: 'admin',
      created_at: new Date(),
    });
    const result = await authenticateUser('admin', 'pass');
    expect(authenticatePam).toHaveBeenCalledWith('admin', 'pass');
    expect(result?.username).toBe('admin');
    expect(result?.is_admin).toBe(false);
  });

  it('authenticateUser returns null when PAM rejects', async () => {
    (authenticatePam as any).mockRejectedValue(new Error('auth failed'));
    const result = await authenticateUser('admin', 'wrong');
    expect(result).toBeNull();
    expect(getOrCreatePamUser).not.toHaveBeenCalled();
  });

  it('authenticateUser returns null on empty input', async () => {
    const result = await authenticateUser('', '');
    expect(result).toBeNull();
    expect(authenticatePam).not.toHaveBeenCalled();
  });
});
