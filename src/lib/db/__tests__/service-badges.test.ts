import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query, execute } from '../client';
import {
  listBadgesForService,
  listServicesForBadge,
  addBadge,
  removeBadge,
  setServiceBadges,
} from '../service-badges';

vi.mock('../client', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

describe('service-badges (join)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listBadgesForService joins to badges', async () => {
    (query as any).mockResolvedValue([]);
    await listBadgesForService(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('JOIN badges b ON b.id = sb.badge_id'),
      [1],
    );
  });

  it('listServicesForBadge filters by slug', async () => {
    (query as any).mockResolvedValue([]);
    await listServicesForBadge('ai');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE b.slug = $1'),
      ['ai'],
    );
  });

  it('addBadge inserts via subquery', async () => {
    (execute as any).mockResolvedValue(undefined);
    await addBadge(1, 'ai');
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO service_badges'),
      [1, 'ai'],
    );
  });

  it('removeBadge deletes via subquery', async () => {
    (execute as any).mockResolvedValue(undefined);
    await removeBadge(1, 'ai');
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM service_badges'),
      [1, 'ai'],
    );
  });

  it('setServiceBadges clears then bulk-inserts', async () => {
    (execute as any).mockResolvedValue(undefined);
    await setServiceBadges(1, ['ai', 'agent']);
    expect((execute as any).mock.calls[0][0]).toBe('DELETE FROM service_badges WHERE service_id = $1');
    expect((execute as any).mock.calls[1][0]).toMatch(/INSERT INTO service_badges/);
    expect((execute as any).mock.calls[1][1]).toEqual([1, ['ai', 'agent']]);
  });

  it('setServiceBadges empty clears only', async () => {
    (execute as any).mockResolvedValue(undefined);
    await setServiceBadges(1, []);
    expect((execute as any).mock.calls.length).toBe(1);
  });

  it('addBadge rejects bad slug', async () => {
    await expect(addBadge(1, 'Bad Slug')).rejects.toThrow(/Invalid badge slug/);
  });
});
