import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import * as healthLog from '@/lib/db/health-log';
import * as serviceDb from '@/lib/db/service';

vi.mock('@/lib/db/health-log', () => ({
  getUptimeStats: vi.fn(),
  getIncidentTransitions: vi.fn(),
}));

vi.mock('@/lib/db/service', () => ({
  getAllServices: vi.fn(),
}));

describe('GET /api/services/uptime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns stats for single service', async () => {
    (healthLog.getUptimeStats as any).mockResolvedValue({
      period: '24h',
      total_checks: 100,
      online_checks: 99,
      uptime_pct: 99,
      avg_response_ms: 45,
    });
    (healthLog.getIncidentTransitions as any).mockResolvedValue([
      { from_status: 'online', to_status: 'offline', changed_at: new Date() },
    ]);

    const req = new Request('http://localhost/api/services/uptime?service_id=1&period=24h');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.service_id).toBe(1);
    expect(json.stats.uptime_pct).toBe(99);
    expect(json.incidents).toHaveLength(1);
  });

  it('returns all services stats', async () => {
    (serviceDb.getAllServices as any).mockResolvedValue([
      { id: 1, slug: 'svc-a', name: 'Service A' },
      { id: 2, slug: 'svc-b', name: 'Service B' },
    ]);
    (healthLog.getUptimeStats as any).mockResolvedValue({
      period: '7d',
      total_checks: 10,
      online_checks: 10,
      uptime_pct: 100,
      avg_response_ms: null,
    });
    (healthLog.getIncidentTransitions as any).mockResolvedValue([]);

    const req = new Request('http://localhost/api/services/uptime?period=7d');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.services).toHaveLength(2);
    expect(json.period).toBe('7d');
  });

  it('defaults period to 24h', async () => {
    (healthLog.getUptimeStats as any).mockResolvedValue({
      period: '24h',
      total_checks: 1,
      online_checks: 1,
      uptime_pct: 100,
      avg_response_ms: null,
    });
    (healthLog.getIncidentTransitions as any).mockResolvedValue([]);

    const req = new Request('http://localhost/api/services/uptime?service_id=1');
    const res = await GET(req);
    const json = await res.json();

    expect(json.stats.period).toBe('24h');
  });

  it('returns 400 for invalid service_id', async () => {
    const req = new Request('http://localhost/api/services/uptime?service_id=abc');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 500 on db error', async () => {
    (healthLog.getUptimeStats as any).mockRejectedValue(new Error('db down'));
    const req = new Request('http://localhost/api/services/uptime?service_id=1');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
