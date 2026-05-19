import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query, queryOne, execute } from '../client';
import {
  getAlertRules,
  getAlertRuleById,
  getEnabledAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  getAlertHistory,
  insertAlertHistory,
} from '../alerts';

vi.mock('../client', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

describe('alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAlertRules returns all rules', async () => {
    const rows = [{ id: 1, service_id: 2, name: 'Rule A', condition: 'offline', threshold_ms: null, enabled: true, created_at: new Date(), updated_at: new Date() }];
    (query as any).mockResolvedValue(rows);
    const result = await getAlertRules();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT id, service_id, name, condition, threshold_ms, enabled, created_at, updated_at FROM alert_rules ORDER BY created_at DESC'));
    expect(result).toEqual(rows);
  });

  it('getAlertRules filters by serviceId', async () => {
    const rows = [{ id: 1, service_id: 2, name: 'Rule A', condition: 'offline', threshold_ms: null, enabled: true, created_at: new Date(), updated_at: new Date() }];
    (query as any).mockResolvedValue(rows);
    const result = await getAlertRules(2);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('service_id = $1'), [2]);
    expect(result).toEqual(rows);
  });

  it('getAlertRuleById returns single rule', async () => {
    const row = { id: 1, service_id: 2, name: 'Rule A', condition: 'offline', threshold_ms: null, enabled: true, created_at: new Date(), updated_at: new Date() };
    (queryOne as any).mockResolvedValue(row);
    const result = await getAlertRuleById(1);
    expect(queryOne).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), [1]);
    expect(result).toEqual(row);
  });

  it('getEnabledAlertRules returns enabled rules', async () => {
    const rows = [{ id: 1, service_id: 2, name: 'Rule A', condition: 'offline', threshold_ms: null, enabled: true, created_at: new Date(), updated_at: new Date() }];
    (query as any).mockResolvedValue(rows);
    const result = await getEnabledAlertRules();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('enabled = true'));
    expect(result).toEqual(rows);
  });

  it('createAlertRule inserts and returns row', async () => {
    const row = { id: 1, service_id: 2, name: 'Rule A', condition: 'offline', threshold_ms: null, enabled: true, created_at: new Date(), updated_at: new Date() };
    (queryOne as any).mockResolvedValue(row);
    const result = await createAlertRule({ service_id: 2, name: 'Rule A', condition: 'offline', threshold_ms: null, enabled: true });
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO alert_rules'),
      [2, 'Rule A', 'offline', null, true],
    );
    expect(result).toEqual(row);
  });

  it('updateAlertRule updates fields', async () => {
    const row = { id: 1, service_id: 2, name: 'Updated', condition: 'offline', threshold_ms: null, enabled: false, created_at: new Date(), updated_at: new Date() };
    (queryOne as any).mockResolvedValue(row);
    const result = await updateAlertRule(1, { name: 'Updated', enabled: false });
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE alert_rules SET'),
      expect.arrayContaining(['Updated', false, 1]),
    );
    expect(result).toEqual(row);
  });

  it('updateAlertRule returns existing row when no fields provided', async () => {
    const row = { id: 1, service_id: 2, name: 'Rule A', condition: 'offline', threshold_ms: null, enabled: true, created_at: new Date(), updated_at: new Date() };
    (queryOne as any).mockResolvedValue(row);
    const result = await updateAlertRule(1, {});
    expect(queryOne).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), [1]);
    expect(result).toEqual(row);
  });

  it('deleteAlertRule calls execute', async () => {
    await deleteAlertRule(1);
    expect(execute).toHaveBeenCalledWith('DELETE FROM alert_rules WHERE id = $1', [1]);
  });

  it('getAlertHistory returns history', async () => {
    const rows = [{ id: 1, rule_id: 2, service_id: 3, status: 'offline', message: 'Service down', created_at: new Date() }];
    (query as any).mockResolvedValue(rows);
    const result = await getAlertHistory();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT id, rule_id, service_id, status, message, created_at FROM alert_history'), [50]);
    expect(result).toEqual(rows);
  });

  it('getAlertHistory filters by ruleId and serviceId', async () => {
    const rows = [{ id: 1, rule_id: 2, service_id: 3, status: 'offline', message: 'Service down', created_at: new Date() }];
    (query as any).mockResolvedValue(rows);
    const result = await getAlertHistory(2, 3, 10);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('rule_id = $1 AND service_id = $2'),
      [2, 3, 10],
    );
    expect(result).toEqual(rows);
  });

  it('insertAlertHistory inserts and returns row', async () => {
    const row = { id: 1, rule_id: 2, service_id: 3, status: 'offline', message: 'Service down', created_at: new Date() };
    (queryOne as any).mockResolvedValue(row);
    const result = await insertAlertHistory(2, 3, 'offline', 'Service down');
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO alert_history'),
      [2, 3, 'offline', 'Service down'],
    );
    expect(result).toEqual(row);
  });
});

import { listAlerts, createAlert, acknowledgeAlert, deleteAlert } from '../alerts';

describe('operational alerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listAlerts filters unacknowledged + severity', async () => {
    (query as any).mockResolvedValue([]);
    await listAlerts({ severity: 'critical', unacknowledged: true, limit: 25 });
    const call = (query as any).mock.calls[0];
    expect(call[0]).toMatch(/severity = \$1 AND acknowledged_at IS NULL/);
    expect(call[1]).toEqual(['critical', 25]);
  });

  it('createAlert inserts with validation', async () => {
    (queryOne as any).mockResolvedValue({ id: 1, kind: 'health', severity: 'warn', title: 't', body: null, source: null, acknowledged_at: null, created_at: new Date() });
    await createAlert({ kind: 'health', severity: 'warn', title: 't' });
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO alerts'),
      ['health', 'warn', 't', null, null],
    );
  });

  it('createAlert rejects bad severity', async () => {
    await expect(createAlert({ kind: 'x', severity: 'oops' as any, title: 't' })).rejects.toThrow(/Invalid alert severity/);
  });

  it('acknowledgeAlert updates only unacknowledged', async () => {
    (queryOne as any).mockResolvedValue(null);
    await acknowledgeAlert(7);
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('acknowledged_at IS NULL'),
      [7],
    );
  });

  it('deleteAlert calls execute', async () => {
    await deleteAlert(1);
    expect(execute).toHaveBeenCalledWith('DELETE FROM alerts WHERE id = $1', [1]);
  });
});
