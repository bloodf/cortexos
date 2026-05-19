import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query, queryOne, execute } from '../client';
import {
  listBadges,
  getBadgeBySlug,
  createBadge,
  updateBadge,
  deleteBadge,
} from '../badges';

vi.mock('../client', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

describe('badges (catalog)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listBadges returns catalog rows', async () => {
    const rows = [{ id: 1, slug: 'ai', label: 'AI', color: '#5b21b6', text_color: '#ffffff' }];
    (query as any).mockResolvedValue(rows);
    const result = await listBadges();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM badges'));
    expect(result).toEqual(rows);
  });

  it('getBadgeBySlug validates slug and queries', async () => {
    (queryOne as any).mockResolvedValue(null);
    await getBadgeBySlug('ai');
    expect(queryOne).toHaveBeenCalledWith(expect.stringContaining('WHERE slug = $1'), ['ai']);
  });

  it('getBadgeBySlug rejects bad slug', async () => {
    await expect(getBadgeBySlug('Bad Slug!')).rejects.toThrow(/Invalid badge slug/);
  });

  it('createBadge inserts with defaults', async () => {
    const row = { id: 1, slug: 'ai', label: 'AI', color: '#1f2937', text_color: '#ffffff' };
    (queryOne as any).mockResolvedValue(row);
    const result = await createBadge({ slug: 'ai', label: 'AI' });
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO badges'),
      ['ai', 'AI', '#1f2937', '#ffffff'],
    );
    expect(result).toEqual(row);
  });

  it('createBadge rejects bad color', async () => {
    await expect(createBadge({ slug: 'ai', label: 'AI', color: 'red' })).rejects.toThrow(/Invalid color/);
  });

  it('updateBadge updates by slug', async () => {
    const row = { id: 1, slug: 'ai', label: 'New', color: '#111111', text_color: '#ffffff' };
    (queryOne as any).mockResolvedValue(row);
    const result = await updateBadge('ai', { label: 'New', color: '#111111' });
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE badges SET'),
      ['New', '#111111', 'ai'],
    );
    expect(result).toEqual(row);
  });

  it('deleteBadge calls execute by slug', async () => {
    (execute as any).mockResolvedValue(undefined);
    await deleteBadge('ai');
    expect(execute).toHaveBeenCalledWith('DELETE FROM badges WHERE slug = $1', ['ai']);
  });
});
