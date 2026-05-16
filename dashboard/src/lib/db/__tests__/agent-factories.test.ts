import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query, queryOne, execute } from '../client';
import {
  getAgentFactory,
  listAgentFactories,
  upsertAgentFactory,
  deleteAgentFactory,
} from '../agent-factories';

vi.mock('../client', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

describe('agent-factories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getAgentFactory queries by slug', async () => {
    (queryOne as any).mockResolvedValue(null);
    await getAgentFactory('pm-role');
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('WHERE slug = $1'),
      ['pm-role'],
    );
  });

  it('getAgentFactory rejects invalid slug', async () => {
    await expect(getAgentFactory('Bad Slug')).rejects.toThrow(/Invalid agent factory slug/);
  });

  it('listAgentFactories filters by kind', async () => {
    (query as any).mockResolvedValue([]);
    await listAgentFactories({ kind: 'role' });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE kind = $1'),
      ['role'],
    );
  });

  it('listAgentFactories without filter', async () => {
    (query as any).mockResolvedValue([]);
    await listAgentFactories();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY kind'));
  });

  it('upsertAgentFactory passes JSON definition', async () => {
    const row = { id: 1, slug: 'pm', name: 'PM', kind: 'role', schema_version: 1, definition: {}, created_by: null };
    (queryOne as any).mockResolvedValue(row);
    await upsertAgentFactory({ slug: 'pm', name: 'PM', kind: 'role', definition: { foo: 1 } });
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (slug) DO UPDATE'),
      ['pm', 'PM', 'role', 1, JSON.stringify({ foo: 1 }), null],
    );
  });

  it('upsertAgentFactory rejects invalid kind', async () => {
    await expect(
      upsertAgentFactory({ slug: 'pm', name: 'PM', kind: 'bogus' as any }),
    ).rejects.toThrow(/Invalid agent factory kind/);
  });

  it('deleteAgentFactory deletes by slug', async () => {
    (execute as any).mockResolvedValue(undefined);
    await deleteAgentFactory('pm');
    expect(execute).toHaveBeenCalledWith(
      'DELETE FROM agent_factories WHERE slug = $1',
      ['pm'],
    );
  });
});
