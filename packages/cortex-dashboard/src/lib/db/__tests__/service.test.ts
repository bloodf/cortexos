import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query, queryOne, execute } from '../client';
import {
  getAllServices,
  getServicesByCategory,
  getCategories,
  createService,
  updateService,
  deleteService,
} from '../service';

vi.mock('../client', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

describe('service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseService = {
    id: 1,
    slug: 'test',
    name: 'Test',
    kind: 'service' as const,
    category: 'Infra',
    description: null,
    health_url: 'http://localhost/health',
    health_type: 'http' as const,
    open_url: 'http://localhost',
    env_source: null,
    status: 'unknown',
    last_check_at: null,
    response_ms: null,
    uptime_24h: null,
    icon_type: 'server',
    icon_color: null,
    icon_image: null,
    sort_order: 0,
    is_active: true,
    has_webui: true,
    show_in_healthcheck: true,
    show_in_webui: true,
  };

  it('getAllServices selects open_url and kind', async () => {
    (query as any).mockResolvedValue([baseService]);
    const result = await getAllServices();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('open_url'));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('kind'));
    expect(result[0].open_url).toBe('http://localhost');
  });

  it('getServicesByCategory includes new columns', async () => {
    (query as any).mockResolvedValue([baseService]);
    const result = await getServicesByCategory('Infra');
    expect(result[0].show_in_webui).toBe(true);
  });

  it('createService inserts new schema', async () => {
    (queryOne as any).mockResolvedValue(baseService);
    await createService(baseService as any);
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('open_url'),
      expect.arrayContaining(['test', 'Test', 'service']),
    );
  });

  it('updateService allows open_url', async () => {
    (queryOne as any).mockResolvedValue({ ...baseService, open_url: 'http://x' });
    const result = await updateService(1, { open_url: 'http://x' });
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('open_url = $1'),
      expect.arrayContaining(['http://x']),
    );
    expect(result.open_url).toBe('http://x');
  });

  it('deleteService calls execute', async () => {
    (execute as any).mockResolvedValue(undefined);
    await deleteService(1);
    expect(execute).toHaveBeenCalledWith('DELETE FROM services WHERE id = $1', [1]);
  });

  it('getCategories returns distinct list', async () => {
    (query as any).mockResolvedValue([{ category: 'AI' }, { category: 'Infra' }]);
    const result = await getCategories();
    expect(result).toEqual(['AI', 'Infra']);
  });
});
