import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query, queryOne, execute } from '../client';
import {
  insertHealthLog,
  getUptimeStats,
  getIncidentTransitions,
} from '../health-log';

vi.mock('../client', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

describe('health-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('insertHealthLog inserts and returns row', async () => {
    const row = {
      id: 1,
      service_id: 2,
      status: 'online' as const,
      response_time_ms: 42,
      checked_at: new Date(),
    };
    (queryOne as any).mockResolvedValue(row);
    const result = await insertHealthLog(2, 'online', 42);
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO service_health_log'),
      [2, 'online', 42],
    );
    expect(result).toEqual(row);
  });

  it('insertHealthLog defaults response_time_ms to null', async () => {
    const row = {
      id: 1,
      service_id: 2,
      status: 'offline' as const,
      response_time_ms: null,
      checked_at: new Date(),
    };
    (queryOne as any).mockResolvedValue(row);
    await insertHealthLog(2, 'offline');
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO service_health_log'),
      [2, 'offline', null],
    );
  });

  it('getUptimeStats returns computed stats', async () => {
    (queryOne as any).mockResolvedValue({
      total_checks: '100',
      online_checks: '98',
      avg_response_ms: '52.3',
    });
    const result = await getUptimeStats(1, '24h');
    expect(result.period).toBe('24h');
    expect(result.total_checks).toBe(100);
    expect(result.online_checks).toBe(98);
    expect(result.uptime_pct).toBe(98);
    expect(result.avg_response_ms).toBe(52);
  });

  it('getUptimeStats returns 100% when no checks', async () => {
    (queryOne as any).mockResolvedValue({
      total_checks: '0',
      online_checks: '0',
      avg_response_ms: null,
    });
    const result = await getUptimeStats(1, '7d');
    expect(result.uptime_pct).toBe(100);
    expect(result.avg_response_ms).toBeNull();
  });

  it('getIncidentTransitions detects status changes', async () => {
    const rows = [
      { status: 'offline', checked_at: new Date('2024-01-01T01:00:00Z') },
      { status: 'online', checked_at: new Date('2024-01-01T00:00:00Z') },
    ];
    (query as any).mockResolvedValue(rows);
    const result = await getIncidentTransitions(1);
    expect(result).toHaveLength(1);
    expect(result[0].from_status).toBe('online');
    expect(result[0].to_status).toBe('offline');
  });

  it('getIncidentTransitions returns empty when no changes', async () => {
    const rows = [
      { status: 'online', checked_at: new Date('2024-01-01T01:00:00Z') },
      { status: 'online', checked_at: new Date('2024-01-01T00:00:00Z') },
    ];
    (query as any).mockResolvedValue(rows);
    const result = await getIncidentTransitions(1);
    expect(result).toHaveLength(0);
  });
});
