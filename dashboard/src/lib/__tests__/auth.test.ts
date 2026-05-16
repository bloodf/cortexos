import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

vi.mock('../db/admin', () => ({
  getUserByUsername: vi.fn(),
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
  hashPassword,
  verifyPassword,
  generateSessionToken,
  authenticateUser,
} from '../auth';
import { getUserByUsername } from '../db/admin';

describe('auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hashPassword returns bcrypt hash', async () => {
    const hash = await hashPassword('password123');
    expect(hash.startsWith('$2')).toBe(true);
    expect(hash.length).toBeGreaterThan(50);
  });

  it('verifyPassword validates correct password', async () => {
    const hash = await bcrypt.hash('secret', 10);
    const result = await verifyPassword('secret', hash);
    expect(result).toBe(true);
  });

  it('verifyPassword rejects wrong password', async () => {
    const hash = await bcrypt.hash('secret', 10);
    const result = await verifyPassword('wrong', hash);
    expect(result).toBe(false);
  });

  it('generateSessionToken returns 64-char hex', () => {
    const tok1 = generateSessionToken();
    const tok2 = generateSessionToken();
    expect(tok1).toHaveLength(64);
    expect(tok2).toHaveLength(64);
    expect(tok1).not.toBe(tok2);
    expect(/^[a-f0-9]+$/.test(tok1)).toBe(true);
  });

  it('authenticateUser returns user on valid credentials', async () => {
    const hash = await bcrypt.hash('pass', 10);
    (getUserByUsername as any).mockResolvedValue({
      id: 1,
      username: 'admin',
      password_hash: hash,
      created_at: new Date(),
    });
    const result = await authenticateUser('admin', 'pass');
    expect(result?.username).toBe('admin');
  });

  it('authenticateUser returns null on missing user', async () => {
    (getUserByUsername as any).mockResolvedValue(null);
    const result = await authenticateUser('nobody', 'pass');
    expect(result).toBeNull();
  });

  it('authenticateUser returns null on wrong password', async () => {
    const hash = await bcrypt.hash('right', 10);
    (getUserByUsername as any).mockResolvedValue({
      id: 1,
      username: 'admin',
      password_hash: hash,
      created_at: new Date(),
    });
    const result = await authenticateUser('admin', 'wrong');
    expect(result).toBeNull();
  });
});
