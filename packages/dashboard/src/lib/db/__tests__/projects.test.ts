import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query, queryOne, execute } from '../client';
import {
  getProject,
  listProjects,
  createProject,
  updateProject,
  deleteProject,
} from '../projects';

vi.mock('../client', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

describe('projects', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getProject by slug', async () => {
    (queryOne as any).mockResolvedValue(null);
    await getProject('demo');
    expect(queryOne).toHaveBeenCalledWith(expect.stringContaining('WHERE slug = $1'), ['demo']);
  });

  it('listProjects orders by slug', async () => {
    (query as any).mockResolvedValue([]);
    await listProjects();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY slug'));
  });

  it('createProject inserts with defaults', async () => {
    (queryOne as any).mockResolvedValue({ id: 1, slug: 'demo', name: 'Demo', messaging_mode: 'single', settings: {} });
    await createProject({ slug: 'demo', name: 'Demo' });
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO projects'),
      ['demo', 'Demo', null, null, 'single', JSON.stringify({})],
    );
  });

  it('createProject rejects bad messaging_mode', async () => {
    await expect(
      createProject({ slug: 'demo', name: 'Demo', messaging_mode: 'broadcast' as any }),
    ).rejects.toThrow(/Invalid messaging_mode/);
  });

  it('updateProject builds dynamic SET', async () => {
    (queryOne as any).mockResolvedValue({ id: 1, slug: 'demo', name: 'New' });
    await updateProject('demo', { name: 'New' });
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE projects SET'),
      ['New', 'demo'],
    );
  });

  it('deleteProject deletes by slug', async () => {
    (execute as any).mockResolvedValue(undefined);
    await deleteProject('demo');
    expect(execute).toHaveBeenCalledWith('DELETE FROM projects WHERE slug = $1', ['demo']);
  });
});
