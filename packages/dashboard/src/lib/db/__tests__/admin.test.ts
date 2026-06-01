import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryOne, execute } from '../client';
import {
  getOrCreatePamUser,
  createSession,
  getSessionByToken,
  deleteSession,
  deleteExpiredSessions,
  deleteUserSessions,
} from '../admin';

vi.mock('../client', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

describe('admin db', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseUser = {
    id: 1,
    username: 'admin',
    created_at: new Date(),
  };

  it('getOrCreatePamUser upserts into pam_users', async () => {
    (queryOne as any).mockResolvedValue(baseUser);
    const result = await getOrCreatePamUser('admin');
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO pam_users'),
      ['admin'],
    );
    expect(result).toEqual(baseUser);
  });

  it('getOrCreatePamUser rejects empty username', async () => {
    await expect(getOrCreatePamUser('   ')).rejects.toThrow('Username required');
  });

  it('getOrCreatePamUser throws on failure', async () => {
    (queryOne as any).mockResolvedValue(null);
    await expect(getOrCreatePamUser('admin')).rejects.toThrow(
      'Failed to get or create PAM user',
    );
  });

  const baseSession = {
    id: 1,
    user_id: 1,
    token: 'tok',
    expires_at: new Date(),
    created_at: new Date(),
    is_admin: false,
  };

  it('createSession inserts and returns session', async () => {
    (queryOne as any).mockResolvedValue(baseSession);
    const expires = new Date('2026-01-01');
    const result = await createSession(1, 'tok', expires, true);
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_sessions'),
      [1, 'tok', expires, true],
    );
    expect(result).toEqual(baseSession);
  });

  it('createSession throws on failure', async () => {
    (queryOne as any).mockResolvedValue(null);
    await expect(createSession(1, 'tok', new Date())).rejects.toThrow(
      'Failed to create session',
    );
  });

  it('getSessionByToken joins pam_users and filters expiry', async () => {
    (queryOne as any).mockResolvedValue({ ...baseSession, username: 'admin' });
    const result = await getSessionByToken('tok');
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('JOIN pam_users'),
      ['tok'],
    );
    expect(result?.username).toBe('admin');
  });

  it('deleteSession calls execute', async () => {
    (execute as any).mockResolvedValue(undefined);
    await deleteSession('tok');
    expect(execute).toHaveBeenCalledWith(
      'DELETE FROM admin_sessions WHERE token = $1',
      ['tok'],
    );
  });

  it('deleteExpiredSessions calls execute', async () => {
    (execute as any).mockResolvedValue(undefined);
    await deleteExpiredSessions();
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('expires_at <= NOW()'),
    );
  });

  it('deleteUserSessions calls execute with userId', async () => {
    (execute as any).mockResolvedValue(undefined);
    await deleteUserSessions(1);
    expect(execute).toHaveBeenCalledWith(
      'DELETE FROM admin_sessions WHERE user_id = $1',
      [1],
    );
  });
});
