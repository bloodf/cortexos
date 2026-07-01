import { describe, expect, it, vi } from 'vitest';
import {
  applyReviewDecision,
  buildReviewMessage,
  processMessage,
  sweep,
} from '../src/processor.js';

vi.mock('../src/model.js', () => ({
  classifyEmail: async () => ({
    verdict: 'uncertain',
    confidence: 0.5,
    reasons: [],
    riskSignals: [],
  }),
  heuristicSpamScore: () => 0,
  shouldKeepInInbox: () => false,
  shouldAutoQuarantine: () => false,
}));
function account(slug) {
  return {
    slug,
    address: `${slug}@example.test`,
    host: 'mail.example.test',
    port: 993,
    secure: true,
    username: `${slug}@example.test`,
    password: 'secret',
    inbox: 'INBOX',
    reviewMailbox: 'Cortex Mail Guardian Review',
  };
}
describe('mail guardian sweep', () => {
  it('does not let skipped messages consume the per-account processing cap', async () => {
    const accounts = [account('one'), account('two'), account('three')];
    const listed = [];
    const deps = {
      config: {
        accounts,
        maxMessagesPerSweep: 1,
        openAiBaseUrl: 'http://127.0.0.1:11434/v1',
        openAiApiKey: 'test',
        model: 'test',
        modelTimeoutMs: 30_000,
        confidenceThreshold: 0.95,
        dryRun: true,
      },
      store: {
        hasProcessed: async (_accountSlug, uid) => uid === 1,
        findRules: async () => [],
        hasAllowRule: async () => false,
        createPendingReview: async () => 10,
        markProcessed: async () => undefined,
        claimPendingActions: async () => [],
      },
      telegram: {
        sendMessage: async () => undefined,
      },
      mail: {
        listInbox: async (mailAccount) => {
          listed.push(mailAccount.slug);
          return [
            { uid: 1, from: 'sender@example.test', subject: 'first', text: 'first' },
            { uid: 2, from: 'sender@example.test', subject: 'second', text: 'second' },
          ];
        },
      },
    };
    await expect(sweep(deps)).resolves.toMatchObject({ processed: 6, review: 3, skipped: 3 });
    expect(listed).toEqual(['one', 'two', 'three']);
  });
});
describe('mail guardian rule pre-filter', () => {
  it('trashes a message matched by a block rule without calling the model', async () => {
    const moved = [];
    const processed = [];
    const deps = {
      config: { accounts: [account('one')], dryRun: false, maxMessagesPerSweep: 10 },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [{ verdict: 'spam', scope: 'sender', ruleType: 'block' }],
        markProcessed: async (slug, uid, action) => {
          processed.push({ slug, uid, action });
        },
      },
      mail: {
        moveToTrash: async (mailAccount, uid) => {
          moved.push({ slug: mailAccount.slug, uid });
          return 'Trash';
        },
      },
    };
    const result = await processMessage(deps, account('one'), {
      uid: 7,
      from: 'blocked@spam.test',
      subject: 'x',
      text: 'y',
    });
    expect(result).toBe('trashed');
    expect(moved).toEqual([{ slug: 'one', uid: 7 }]);
    expect(processed).toEqual([{ slug: 'one', uid: 7, action: 'trashed' }]);
  });
});
describe('mail guardian Telegram review message', () => {
  it('shows only sender and subject, not body or generated summaries', () => {
    const message = buildReviewMessage({
      accountAddress: 'inbox@example.test',
      from: 'Sender <sender@example.test>',
      subject: 'Quarterly invoice',
      verdict: 'uncertain',
      confidence: 0.61,
      reviewId: 123,
    });
    expect(message).toContain('From: Sender <sender@example.test>');
    expect(message).toContain('Subject: Quarterly invoice');
    expect(message).not.toContain('Summary:');
    expect(message).not.toContain('Body:');
    expect(message).not.toContain('invoice body private details');
  });
});
describe('mail guardian review decisions', () => {
  it('blocks the sender when a message is marked as spam', async () => {
    const rules = [];
    const moved = [];
    const processed = [];
    const deps = {
      config: {
        accounts: [account('one')],
        dryRun: false,
      },
      store: {
        getReview: async () => ({
          id: 42,
          account_slug: 'one',
          message_uid: 101,
          message_id: '<message-101@example.test>',
          from_hash: 'sender-hash',
          domain_hash: 'domain-hash',
        }),
        addRule: async (ruleType, scope, valueHash) => {
          rules.push({ ruleType, scope, valueHash });
        },
        markProcessed: async (slug, uid, action) => {
          processed.push({ slug, uid, action });
        },
        resolveReview: async () => undefined,
      },
      mail: {
        moveToTrash: async (mailAccount, uid) => {
          moved.push({ slug: mailAccount.slug, uid });
          return 'Trash';
        },
      },
    };
    await applyReviewDecision(deps, 42, 'spam', 'telegram');
    expect(moved).toEqual([{ slug: 'one', uid: 101 }]);
    expect(processed).toEqual([{ slug: 'one', uid: 101, action: 'trashed' }]);
    expect(rules).toEqual([{ ruleType: 'block', scope: 'sender', valueHash: 'sender-hash' }]);
  });
});
//# sourceMappingURL=processor.test.js.map
