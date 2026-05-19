import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryOne } from '../client';
import { getChatSession, upsertChatSession } from '../chat-sessions';

vi.mock('../client', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

describe('chat-sessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getChatSession queries by user_id', async () => {
    (queryOne as any).mockResolvedValue(null);
    await getChatSession(1);
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = $1'),
      [1],
    );
  });

  it('getChatSession rejects bad user_id', async () => {
    await expect(getChatSession(0)).rejects.toThrow(/positive integer/);
  });

  it('upsertChatSession with messages', async () => {
    (queryOne as any).mockResolvedValue({ user_id: 1, panel_open: true, width: 360, messages: [] });
    await upsertChatSession(1, { panel_open: true, messages: [{ role: 'user', content: 'hi' }] });
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (user_id) DO UPDATE'),
      [1, true, null, JSON.stringify([{ role: 'user', content: 'hi' }])],
    );
  });

  it('upsertChatSession rejects bad width', async () => {
    await expect(upsertChatSession(1, { width: 50 })).rejects.toThrow(/width must be/);
  });
});
