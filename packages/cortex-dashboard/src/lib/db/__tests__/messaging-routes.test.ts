import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query, queryOne, execute } from '../client';
import { listRoutes, addRoute, removeRoute } from '../messaging-routes';

vi.mock('../client', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

describe('messaging-routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listRoutes without project returns all', async () => {
    (query as any).mockResolvedValue([]);
    await listRoutes();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM messaging_routes'));
  });

  it('listRoutes with projectId filters', async () => {
    (query as any).mockResolvedValue([]);
    await listRoutes(7);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE project_id = $1'), [7]);
  });

  it('addRoute inserts with jsonb config', async () => {
    (queryOne as any).mockResolvedValue({ id: 1, project_id: 1, platform: 'slack', account_ref: 'acct', route_config: {}, approval_gates: [] });
    await addRoute({ project_id: 1, platform: 'slack', account_ref: 'acct' });
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messaging_routes'),
      [1, 'slack', 'acct', JSON.stringify({}), []],
    );
  });

  it('addRoute rejects bad platform', async () => {
    await expect(
      addRoute({ project_id: 1, platform: 'fax' as any, account_ref: 'acct' }),
    ).rejects.toThrow(/Invalid messaging platform/);
  });

  it('removeRoute deletes by id', async () => {
    (execute as any).mockResolvedValue(undefined);
    await removeRoute(5);
    expect(execute).toHaveBeenCalledWith('DELETE FROM messaging_routes WHERE id = $1', [5]);
  });
});
