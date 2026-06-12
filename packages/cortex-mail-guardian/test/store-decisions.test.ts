import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redactEmail } from '../src/redact.js';

const querySpy = vi.hoisted(() => vi.fn());

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(() => ({
      query: querySpy,
      end: vi.fn(),
    })),
  },
}));

const { GuardianStore } = await import('../src/store.js');

const config = {
  databaseUrl: 'postgres://test',
  dryRun: false,
  accounts: [],
  model: 'test',
  fallbackModel: 'test-fb',
  nineRouterBaseUrl: 'http://localhost',
  nineRouterApiKey: 'key',
  modelTimeoutMs: 5_000,
  confidenceThreshold: 0.95,
  maxMessagesPerSweep: 10,
  db: { host: 'localhost', port: 5432, database: 'test', user: 'test', password: 'test' },
};

describe('GuardianStore.recordDecision', () => {
  beforeEach(() => {
    querySpy.mockReset();
    querySpy.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it('upserts a decision row with all non-null fields', async () => {
    const store = new GuardianStore(config as never);
    const redacted = redactEmail({ from: 'sender@example.test', subject: 'hello', text: 'body' });

    await store.recordDecision({
      accountSlug: 'test-account',
      messageUid: 42,
      fromHash: redacted.fromHash,
      domainHash: redacted.domainHash,
      summary: redacted.summary,
      model: 'minimax/MiniMax-M3',
      verdict: 'spam',
      confidence: 0.98,
      reasons: ['phishing'],
      riskSignals: ['credential request'],
      verifyModel: 'cx/gpt-5.5',
      verifyVerdict: 'spam',
      verifyConfidence: 0.95,
      outcome: 'pending',
    });

    expect(querySpy).toHaveBeenCalledOnce();
    const [sql, params] = querySpy.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('mail_guardian_decisions');
    expect(sql).toContain('ON CONFLICT');
    expect(params).toContain(redacted.fromHash);
    expect(params).toContain(redacted.domainHash);
    expect(params).toContain(redacted.summary);
    expect(params).toContain('minimax/MiniMax-M3');
    expect(params).toContain('spam');
    expect(params).toContain(0.98);
    expect(params).toContain('cx/gpt-5.5');
    expect(params).toContain('pending');
  });

  it('passes reasons and risk_signals as serialised JSON', async () => {
    const store = new GuardianStore(config as never);
    const redacted = redactEmail({ from: 'x@y.test', subject: 's', text: 't' });

    await store.recordDecision({
      accountSlug: 'acc',
      messageUid: 1,
      fromHash: redacted.fromHash,
      domainHash: redacted.domainHash,
      summary: redacted.summary,
      model: null,
      verdict: null,
      confidence: null,
      reasons: ['reason-a', 'reason-b'],
      riskSignals: ['signal-x'],
      verifyModel: null,
      verifyVerdict: null,
      verifyConfidence: null,
      outcome: 'pending',
    });

    const params = querySpy.mock.calls[0][1] as unknown[];
    const reasonsParam = params.find((p) => typeof p === 'string' && p.includes('reason-a'));
    const signalsParam = params.find((p) => typeof p === 'string' && p.includes('signal-x'));
    expect(JSON.parse(reasonsParam as string)).toEqual(['reason-a', 'reason-b']);
    expect(JSON.parse(signalsParam as string)).toEqual(['signal-x']);
  });
});

describe('GuardianStore.updateDecisionOutcome', () => {
  beforeEach(() => {
    querySpy.mockReset();
  });

  it('updates outcome and decided_at for a matching row', async () => {
    querySpy.mockResolvedValue({ rows: [], rowCount: 1 });
    const store = new GuardianStore(config as never);

    await store.updateDecisionOutcome('test-account', 42, 'owner_spam');

    expect(querySpy).toHaveBeenCalledOnce();
    const [sql, params] = querySpy.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE mail_guardian_decisions');
    expect(sql).toContain('decided_at');
    expect(params).toContain('test-account');
    expect(params).toContain(42);
    expect(params).toContain('owner_spam');
  });

  it('resolves without throwing when no matching row exists', async () => {
    querySpy.mockResolvedValue({ rows: [], rowCount: 0 });
    const store = new GuardianStore(config as never);

    await expect(store.updateDecisionOutcome('old-account', 99, 'owner_keep')).resolves.toBeUndefined();
  });
});

describe('GuardianStore.listRecentDecisions', () => {
  beforeEach(() => {
    querySpy.mockReset();
    querySpy.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('queries only owner-confirmed outcomes (not pending or model-path outcomes)', async () => {
    const store = new GuardianStore(config as never);

    await store.listRecentDecisions(50);

    expect(querySpy).toHaveBeenCalledOnce();
    const [sql, params] = querySpy.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('owner_spam');
    expect(sql).toContain('owner_keep');
    expect(sql).toContain('owner_block');
    expect(sql).toContain('owner_allow');
    expect(sql).not.toContain("!= 'pending'");
    expect(sql).not.toContain('auto_trashed');
    expect(params).toContain(50);
  });

  it('orders disagreements first, then created_at DESC', async () => {
    const store = new GuardianStore(config as never);

    await store.listRecentDecisions(100);

    const [sql] = querySpy.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ORDER BY');
    expect(sql).toContain('created_at DESC');
    expect(sql).toMatch(/CASE/i);
    expect(sql).toContain("verdict = 'spam'");
  });

  it('returns mapped rows', async () => {
    querySpy.mockResolvedValue({
      rows: [
        { account_slug: 'acc', message_uid: 1, from_hash: 'fh', domain_hash: 'dh', summary: 's', verdict: 'spam', outcome: 'owner_keep', created_at: new Date() },
      ],
      rowCount: 1,
    });
    const store = new GuardianStore(config as never);

    const rows = await store.listRecentDecisions(10);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ summary: 's', verdict: 'spam', outcome: 'owner_keep' });
  });
});

describe('GuardianStore.insertBrief', () => {
  beforeEach(() => {
    querySpy.mockReset();
    querySpy.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it('inserts into mail_guardian_knowledge with brief and source_decisions', async () => {
    const store = new GuardianStore(config as never);

    await store.insertBrief('Owner prefers no newsletters.', 42);

    expect(querySpy).toHaveBeenCalledOnce();
    const [sql, params] = querySpy.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('mail_guardian_knowledge');
    expect(sql).toContain('INSERT');
    expect(params).toContain('Owner prefers no newsletters.');
    expect(params).toContain(42);
  });
});

describe('GuardianStore.getLatestBrief', () => {
  beforeEach(() => {
    querySpy.mockReset();
  });

  it('returns null when table is empty', async () => {
    querySpy.mockResolvedValue({ rows: [], rowCount: 0 });
    const store = new GuardianStore(config as never);

    const result = await store.getLatestBrief();

    expect(result).toBeNull();
  });

  it('returns the most recent brief ordered by generated_at DESC, id DESC', async () => {
    const row = { id: 7, brief: 'brief text', source_decisions: 5, generated_at: new Date() };
    querySpy.mockResolvedValue({ rows: [row], rowCount: 1 });
    const store = new GuardianStore(config as never);

    const result = await store.getLatestBrief();

    expect(result).toMatchObject({ id: 7, brief: 'brief text', source_decisions: 5 });
    const [sql] = querySpy.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ORDER BY generated_at DESC');
    expect(sql).toContain('id DESC');
  });
});
