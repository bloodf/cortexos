import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query, queryOne } from '../client';
import { insertAuditRow, listAudit } from '../dashboard-audit';
import * as auditModule from '../dashboard-audit';

vi.mock('../client', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

describe('dashboard-audit (append-only)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does NOT export update or delete functions', () => {
    expect((auditModule as any).updateAuditRow).toBeUndefined();
    expect((auditModule as any).deleteAuditRow).toBeUndefined();
  });

  it('insertAuditRow inserts full row', async () => {
    (queryOne as any).mockResolvedValue({ id: 1, ts: new Date() });
    await insertAuditRow({
      tool_class: 'safe',
      args_hash: 'sha256:abc',
      decision: 'allow',
      result: 'ok',
    });
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO agent_gateway_audit'),
      expect.any(Array),
    );
  });

  it('insertAuditRow rejects invalid decision', async () => {
    await expect(
      insertAuditRow({
        tool_class: 'safe',
        args_hash: 'h',
        decision: 'maybe' as any,
        result: 'ok',
      }),
    ).rejects.toThrow(/Invalid decision/);
  });

  it('insertAuditRow rejects missing args_hash', async () => {
    await expect(
      insertAuditRow({
        tool_class: 'safe',
        args_hash: '',
        decision: 'allow',
        result: 'ok',
      }),
    ).rejects.toThrow(/args_hash is required/);
  });

  it('listAudit applies filters', async () => {
    (query as any).mockResolvedValue([]);
    await listAudit({ actor_user_id: 1, decision: 'deny', limit: 50 });
    const call = (query as any).mock.calls[0];
    expect(call[0]).toMatch(/WHERE actor_user_id = \$1 AND decision = \$2/);
    expect(call[0]).toMatch(/LIMIT \$3 OFFSET \$4/);
    expect(call[1]).toEqual([1, 'deny', 50, 0]);
  });

  it('listAudit caps limit', async () => {
    (query as any).mockResolvedValue([]);
    await listAudit({ limit: 999999 });
    const call = (query as any).mock.calls[0];
    // LIMIT is second-to-last (offset appended last)
    expect(call[1][call[1].length - 2]).toBe(1000);
    expect(call[1][call[1].length - 1]).toBe(0);
  });

  it('listAudit pushes offset into SQL', async () => {
    (query as any).mockResolvedValue([]);
    await listAudit({ limit: 25, offset: 50 });
    const call = (query as any).mock.calls[0];
    expect(call[0]).toMatch(/LIMIT \$1 OFFSET \$2/);
    expect(call[1]).toEqual([25, 50]);
  });
});
