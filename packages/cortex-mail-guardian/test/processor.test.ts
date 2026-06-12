import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProcessDeps } from '../src/processor.js';
import {
  applyReviewDecision,
  buildReviewMessage,
  processMessage,
  sweep,
} from '../src/processor.js';

const classifyWithFallbackMock = vi.fn(async () => ({
  result: { verdict: 'uncertain' as const, confidence: 0.5, reasons: [] as string[], riskSignals: [] as string[] },
  modelUsed: 'test-model',
  attempts: 1,
}));
const shouldKeepInInboxMock = vi.fn(() => false);
const shouldAutoQuarantineMock = vi.fn(() => false);

vi.mock('../src/model.js', () => ({
  classifyWithFallback: (...args: unknown[]) => classifyWithFallbackMock(...args),
  heuristicSpamScore: () => 0,
  shouldKeepInInbox: (...args: unknown[]) => shouldKeepInInboxMock(...args),
  shouldAutoQuarantine: (...args: unknown[]) => shouldAutoQuarantineMock(...args),
  shouldAutoTrash: () => false,
}));

beforeEach(() => {
  classifyWithFallbackMock.mockReset();
  classifyWithFallbackMock.mockResolvedValue({
    result: { verdict: 'uncertain' as const, confidence: 0.5, reasons: [] as string[], riskSignals: [] as string[] },
    modelUsed: 'test-model',
    attempts: 1,
  });
  shouldAutoQuarantineMock.mockReset();
  shouldAutoQuarantineMock.mockReturnValue(false);
  shouldKeepInInboxMock.mockReset();
  shouldKeepInInboxMock.mockReturnValue(false);
});

function account(slug: string) {
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
    const listed: string[] = [];
    const deps = {
      config: {
        accounts,
        maxMessagesPerSweep: 1,
        nineRouterBaseUrl: 'http://127.0.0.1:11434/v1',
        nineRouterApiKey: 'test',
        model: 'test',
        fallbackModel: 'test-fallback',
        modelTimeoutMs: 30_000,
        confidenceThreshold: 0.95,
        dryRun: true,
      },
      store: {
        hasProcessed: async (_accountSlug: string, uid: number) => uid === 1,
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
        listInbox: async (mailAccount: { slug: string }) => {
          listed.push(mailAccount.slug);
          return [
            { uid: 1, from: 'sender@example.test', subject: 'first', text: 'first' },
            { uid: 2, from: 'sender@example.test', subject: 'second', text: 'second' },
          ];
        },
      },
    } as unknown as ProcessDeps;

    await expect(sweep(deps)).resolves.toMatchObject({ processed: 6, review: 3, skipped: 3 });
    expect(listed).toEqual(['one', 'two', 'three']);
  });
});

describe('mail guardian rule pre-filter', () => {
  it('trashes a message matched by a block rule without calling the model', async () => {
    const moved: { slug: string; uid: number }[] = [];
    const processed: { slug: string; uid: number; action: string }[] = [];
    const deps = {
      config: { accounts: [account('one')], dryRun: false, maxMessagesPerSweep: 10 },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [{ verdict: 'spam', scope: 'sender', ruleType: 'block' }],
        markProcessed: async (slug: string, uid: number, action: string) => {
          processed.push({ slug, uid, action });
        },
      },
      mail: {
        moveToTrash: async (mailAccount: { slug: string }, uid: number) => {
          moved.push({ slug: mailAccount.slug, uid });
          return 'Trash';
        },
      },
    } as unknown as ProcessDeps;

    const result = await processMessage(deps, account('one'), {
      uid: 7,
      from: 'blocked@spam.test',
      subject: 'x',
      text: 'y',
    });

    expect(result).toBe('trashed');
    expect(moved).toEqual([{ slug: 'one', uid: 7 }]);
    expect(processed).toEqual([{ slug: 'one', uid: 7, action: 'trashed' }]);
    expect(classifyWithFallbackMock).not.toHaveBeenCalled();
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
    const rules: { ruleType: string; scope: string; valueHash: string }[] = [];
    const moved: { slug: string; uid: number }[] = [];
    const processed: { slug: string; uid: number; action: string }[] = [];
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
        addRule: async (ruleType: string, scope: string, valueHash: string) => {
          rules.push({ ruleType, scope, valueHash });
        },
        markProcessed: async (slug: string, uid: number, action: string) => {
          processed.push({ slug, uid, action });
        },
        resolveReview: async () => undefined,
      },
      mail: {
        moveToTrash: async (mailAccount: { slug: string }, uid: number) => {
          moved.push({ slug: mailAccount.slug, uid });
          return 'Trash';
        },
      },
    } as unknown as ProcessDeps;

    await applyReviewDecision(deps, 42, 'spam', 'telegram');

    expect(moved).toEqual([{ slug: 'one', uid: 101 }]);
    expect(processed).toEqual([{ slug: 'one', uid: 101, action: 'trashed' }]);
    expect(rules).toEqual([{ ruleType: 'block', scope: 'sender', valueHash: 'sender-hash' }]);
  });
});

describe('mail guardian processMessage — auto-trash branch', () => {
  it('moves to trash, resolves review, sends plain FYI with no reply_markup, returns trashed', async () => {
    shouldAutoQuarantineMock.mockReturnValue(true);
    const moved: string[] = [];
    const processedActions: string[] = [];
    const resolvedIds: number[] = [];
    const telegramCalls: unknown[][] = [];

    const deps = {
      config: {
        accounts: [account('one')],
        nineRouterBaseUrl: 'http://127.0.0.1:11434/v1',
        nineRouterApiKey: 'test',
        model: 'minimax/MiniMax-M3',
        fallbackModel: 'cx/gpt-5.5',
        modelTimeoutMs: 30_000,
        confidenceThreshold: 0.95,
        dryRun: false,
        telegramOwnerChatId: '999',
      },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        createPendingReview: async () => 55,
        markProcessed: async (_slug: string, _uid: number, action: string) => {
          processedActions.push(action);
        },
        resolveReview: async (id: number) => {
          resolvedIds.push(id);
        },
      },
      mail: {
        moveToTrash: async (_acct: unknown, uid: number) => {
          moved.push(`trash:${uid}`);
        },
      },
      telegram: {
        sendMessage: async (...args: unknown[]) => {
          telegramCalls.push(args);
        },
      },
    } as unknown as ProcessDeps;

    const result = await processMessage(deps, account('one'), {
      uid: 42,
      from: 'spammer@evil.test',
      subject: 'win prizes',
      text: 'click here now',
    });

    expect(result).toBe('trashed');
    expect(moved).toEqual(['trash:42']);
    expect(processedActions).toContain('trashed');
    expect(resolvedIds).toContain(55);
    expect(telegramCalls).toHaveLength(1);
    const [, , replyMarkup] = telegramCalls[0] as [unknown, unknown, unknown];
    expect(replyMarkup).toBeUndefined();
  });

  it('records would_trash under dryRun, still resolves review', async () => {
    shouldAutoQuarantineMock.mockReturnValue(true);
    const processedActions: string[] = [];
    const resolvedIds: number[] = [];

    const deps = {
      config: {
        accounts: [account('one')],
        nineRouterBaseUrl: 'http://127.0.0.1:11434/v1',
        nineRouterApiKey: 'test',
        model: 'minimax/MiniMax-M3',
        fallbackModel: 'cx/gpt-5.5',
        modelTimeoutMs: 30_000,
        confidenceThreshold: 0.95,
        dryRun: true,
      },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        createPendingReview: async () => 56,
        markProcessed: async (_slug: string, _uid: number, action: string) => {
          processedActions.push(action);
        },
        resolveReview: async (id: number) => {
          resolvedIds.push(id);
        },
      },
      mail: {},
      telegram: { sendMessage: async () => undefined },
    } as unknown as ProcessDeps;

    const result = await processMessage(deps, account('one'), {
      uid: 43,
      from: 'spammer@evil.test',
      subject: 'win prizes',
      text: 'click here now',
    });

    expect(result).toBe('trashed');
    expect(processedActions).toContain('would_trash');
    expect(resolvedIds).toContain(56);
  });
});

describe('mail guardian processMessage — classify_failed dead-letter', () => {
  it('stores classify_failed and returns review when classification throws', async () => {
    classifyWithFallbackMock.mockRejectedValueOnce(new Error('model error'));
    const processedActions: string[] = [];

    const deps = {
      config: {
        accounts: [account('one')],
        nineRouterBaseUrl: 'http://127.0.0.1:11434/v1',
        nineRouterApiKey: 'test',
        model: 'minimax/MiniMax-M3',
        fallbackModel: 'cx/gpt-5.5',
        modelTimeoutMs: 30_000,
        confidenceThreshold: 0.95,
        dryRun: false,
      },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        createPendingReview: async () => 77,
        markProcessed: async (_slug: string, _uid: number, action: string) => {
          processedActions.push(action);
        },
      },
      mail: { moveToReview: async () => undefined },
      telegram: { sendMessage: async () => undefined },
    } as unknown as ProcessDeps;

    const result = await processMessage(deps, account('one'), {
      uid: 10,
      from: 'x@y.test',
      subject: 'test',
      text: 'body',
    });

    expect(result).toBe('review');
    expect(processedActions).toContain('classify_failed');
  });

  it('stores classify_failed and returns review when verification throws', async () => {
    classifyWithFallbackMock
      .mockResolvedValueOnce({
        result: { verdict: 'spam' as const, confidence: 0.99, reasons: [] as string[], riskSignals: [] as string[] },
        modelUsed: 'primary',
        attempts: 1,
      })
      .mockRejectedValueOnce(new Error('verify error'));
    const processedActions: string[] = [];

    const deps = {
      config: {
        accounts: [account('one')],
        nineRouterBaseUrl: 'http://127.0.0.1:11434/v1',
        nineRouterApiKey: 'test',
        model: 'minimax/MiniMax-M3',
        fallbackModel: 'cx/gpt-5.5',
        modelTimeoutMs: 30_000,
        confidenceThreshold: 0.95,
        dryRun: false,
      },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        createPendingReview: async () => 78,
        markProcessed: async (_slug: string, _uid: number, action: string) => {
          processedActions.push(action);
        },
      },
      mail: { moveToReview: async () => undefined },
      telegram: { sendMessage: async () => undefined },
    } as unknown as ProcessDeps;

    const result = await processMessage(deps, account('one'), {
      uid: 11,
      from: 'x@y.test',
      subject: 'test',
      text: 'body',
    });

    expect(result).toBe('review');
    expect(processedActions).toContain('classify_failed');
  });
});

describe('mail guardian processMessage — cross-model call signatures', () => {
  it('classifies with primary+fallback and verifies with fallback+null, no feedbackSummary', async () => {
    const deps = {
      config: {
        accounts: [account('one')],
        nineRouterBaseUrl: 'http://127.0.0.1:11434/v1',
        nineRouterApiKey: 'test',
        model: 'minimax/MiniMax-M3',
        fallbackModel: 'cx/gpt-5.5',
        modelTimeoutMs: 30_000,
        confidenceThreshold: 0.95,
        dryRun: true,
      },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        createPendingReview: async () => 99,
        markProcessed: async () => undefined,
      },
      mail: { moveToReview: async () => undefined },
      telegram: { sendMessage: async () => undefined },
    } as unknown as ProcessDeps;

    await processMessage(deps, account('one'), {
      uid: 20,
      from: 'x@y.test',
      subject: 'test',
      text: 'body',
    });

    expect(classifyWithFallbackMock).toHaveBeenCalledTimes(2);

    const [classifyPrimary, classifyFallback, classifyInput] =
      classifyWithFallbackMock.mock.calls[0] as [{ model: string }, { model: string } | null, Record<string, unknown>];
    expect(classifyPrimary.model).toBe('minimax/MiniMax-M3');
    expect(classifyFallback?.model).toBe('cx/gpt-5.5');
    expect(classifyInput).not.toHaveProperty('feedbackSummary');

    const [verifyPrimary, verifyFallback, verifyInput] =
      classifyWithFallbackMock.mock.calls[1] as [{ model: string }, null, Record<string, unknown>];
    expect(verifyPrimary.model).toBe('cx/gpt-5.5');
    expect(verifyFallback).toBeNull();
    expect(verifyInput).not.toHaveProperty('feedbackSummary');
  });
});
