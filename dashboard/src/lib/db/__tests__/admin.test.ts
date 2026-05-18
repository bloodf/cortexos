import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryOne, execute } from '../client';
import {
  getUserByUsername,
  getUserById,
  createUser,
  updateUserPassword,
  deleteUser,
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
    password_hash: 'hash',
    created_at: new Date(),
  };

  it('getUserByUsername queries correct columns', async () => {
    (queryOne as any).mockResolvedValue(baseUser);
    const result = await getUserByUsername('admin');
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('admin_users'),
      ['admin'],
    );
    expect(result).toEqual(baseUser);
  });

  it('getUserById queries by id', async () => {
    (queryOne as any).mockResolvedValue(baseUser);
    const result = await getUserById(1);
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('id = $1'),
      [1],
    );
    expect(result).toEqual(baseUser);
  });

  it('createUser inserts and returns user', async () => {
    (queryOne as any).mockResolvedValue(baseUser);
    const result = await createUser('admin', 'hash');
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_users'),
      ['admin', 'hash', false],
    );
    expect(result).toEqual(baseUser);
  });

  it('createUser throws on failure', async () => {
    (queryOne as any).mockResolvedValue(null);
    await expect(createUser('admin', 'hash')).rejects.toThrow('Failed to create user');
  });

  it('updateUserPassword calls execute', async () => {
    (execute as any).mockResolvedValue(undefined);
    await updateUserPassword(1, 'newhash');
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE admin_users'),
      ['newhash', 1],
    );
  });

  it('deleteUser calls execute', async () => {
    (execute as any).mockResolvedValue(undefined);
    await deleteUser(1);
    expect(execute).toHaveBeenCalledWith(
      'DELETE FROM admin_users WHERE id = $1',
      [1],
    );
  });

  const baseSession = {
    id: 1,
    user_id: 1,
    token: 'tok',
    expires_at: new Date(),
    created_at: new Date(),
  };

  it('createSession inserts and returns session', async () => {
    (queryOne as any).mockResolvedValue(baseSession);
    const expires = new Date('2026-01-01');
    const result = await createSession(1, 'tok', expires);
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_sessions'),
      [1, 'tok', expires],
    );
    expect(result).toEqual(baseSession);
  });

  it('createSession throws on failure', async () => {
    (queryOne as any).mockResolvedValue(null);
    await expect(createSession(1, 'tok', new Date())).rejects.toThrow('Failed to create session');
  });

  it('getSessionByToken joins users and filters expiry', async () => {
    (queryOne as any).mockResolvedValue({ ...baseSession, username: 'admin' });
    const result = await getSessionByToken('tok');
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('JOIN admin_users'),
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
