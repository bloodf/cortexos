import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProcessDeps } from '../src/processor.js';
import {
  applyReviewDecision,
  buildReviewMessage,
  handleTelegramUpdates,
  processMessage,
  sweep,
} from '../src/processor.js';

const classifyWithFallbackMock = vi.fn(async () => ({
  result: {
    verdict: 'uncertain' as const,
    confidence: 0.5,
    reasons: [] as string[],
    riskSignals: [] as string[],
  },
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
    result: {
      verdict: 'uncertain' as const,
      confidence: 0.5,
      reasons: [] as string[],
      riskSignals: [] as string[],
    },
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

const baseConfig = {
  nineRouterBaseUrl: 'http://127.0.0.1:11434/v1',
  nineRouterApiKey: 'test',
  model: 'minimax/MiniMax-M3',
  fallbackModel: 'cx/gpt-5.5',
  modelTimeoutMs: 30_000,
  confidenceThreshold: 0.95,
  dryRun: false,
};

describe('mail guardian sweep', () => {
  it('does not let skipped messages consume the per-account processing cap', async () => {
    const accounts = [account('one'), account('two'), account('three')];
    const listed: string[] = [];
    const deps = {
      config: {
        accounts,
        maxMessagesPerSweep: 1,
        ...baseConfig,
        dryRun: true,
      },
      store: {
        hasProcessed: async (_accountSlug: string, uid: number) => uid === 1,
        findRules: async () => [],
        hasAllowRule: async () => false,
        getLatestBrief: async () => null,
        createPendingReview: async () => 10,
        markProcessed: async () => undefined,
        recordDecision: async () => undefined,
        claimPendingActions: async () => [],
        countOpenReviews: async () => 0,
        raiseBacklogAlert: async () => undefined,
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
        moveToReview: async () => undefined,
      },
    } as unknown as ProcessDeps;

    await expect(sweep(deps)).resolves.toMatchObject({ processed: 6, review: 3, skipped: 3 });
    expect(listed).toEqual(['one', 'two', 'three']);
  });
});

describe('mail guardian open-review backlog metric', () => {
  function backlogDeps(openReviews: number) {
    const raiseBacklogAlert = vi.fn(async () => undefined);
    const deps = {
      config: { accounts: [], maxMessagesPerSweep: 1, ...baseConfig },
      store: {
        claimPendingActions: async () => [],
        countOpenReviews: async () => openReviews,
        raiseBacklogAlert,
      },
      telegram: { sendMessage: async () => undefined },
      mail: { listInbox: async () => [], moveToReview: async () => undefined },
    } as unknown as ProcessDeps;
    return { deps, raiseBacklogAlert };
  }

  it('exposes the open-review count in the sweep result', async () => {
    const { deps } = backlogDeps(42);
    await expect(sweep(deps)).resolves.toMatchObject({ openReviews: 42 });
  });

  it('warns and raises an alert when the backlog exceeds the threshold', async () => {
    const warnings: string[] = [];
    const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      warnings.push(String(chunk));
      return true;
    });
    const { deps, raiseBacklogAlert } = backlogDeps(314);

    await sweep(deps);

    spy.mockRestore();
    const warning = warnings.find((w) => w.includes('mail_guardian_backlog_warning'));
    expect(warning).toBeDefined();
    expect(warning).toContain('"openReviews":314');
    expect(raiseBacklogAlert).toHaveBeenCalledWith(314, 100);
  });

  it('stays silent when the backlog is within the threshold', async () => {
    const { deps, raiseBacklogAlert } = backlogDeps(5);
    await sweep(deps);
    expect(raiseBacklogAlert).not.toHaveBeenCalled();
  });
});

describe('mail guardian rule pre-filter', () => {
  it('trashes a message matched by a block rule without calling the model', async () => {
    const moved: { slug: string; uid: number }[] = [];
    const processed: { slug: string; uid: number; action: string }[] = [];
    const recordDecisionCalls: unknown[] = [];
    const deps = {
      config: { accounts: [account('one')], dryRun: false, maxMessagesPerSweep: 10 },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [{ verdict: 'spam', scope: 'sender', ruleType: 'block' }],
        markProcessed: async (slug: string, uid: number, action: string) => {
          processed.push({ slug, uid, action });
        },
        recordDecision: async (...args: unknown[]) => {
          recordDecisionCalls.push(args);
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
    expect(recordDecisionCalls).toHaveLength(0);
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
    const outcomeUpdates: { accountSlug: string; uid: number; outcome: string }[] = [];
    const resolveOrder: string[] = [];

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
        updateDecisionOutcome: async (accountSlug: string, uid: number, outcome: string) => {
          outcomeUpdates.push({ accountSlug, uid, outcome });
          resolveOrder.push('updateDecisionOutcome');
        },
        resolveReview: async () => {
          resolveOrder.push('resolveReview');
        },
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
    expect(outcomeUpdates).toEqual([{ accountSlug: 'one', uid: 101, outcome: 'owner_spam' }]);
    expect(resolveOrder).toEqual(['updateDecisionOutcome', 'resolveReview']);
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
        ...baseConfig,
        telegramBotToken: 'test-token',
        telegramOwnerChatId: '999',
      },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        getLatestBrief: async () => null,
        createPendingReview: async () => 55,
        markProcessed: async (_slug: string, _uid: number, action: string) => {
          processedActions.push(action);
        },
        resolveReview: async (id: number) => {
          resolvedIds.push(id);
        },
        recordDecision: async () => undefined,
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

  it('records outcome auto_trashed with classifier and verifier model data', async () => {
    shouldAutoQuarantineMock.mockReturnValue(true);
    classifyWithFallbackMock
      .mockResolvedValueOnce({
        result: {
          verdict: 'spam' as const,
          confidence: 0.98,
          reasons: ['phishing'] as string[],
          riskSignals: ['link'] as string[],
        },
        modelUsed: 'minimax/MiniMax-M3',
        attempts: 1,
      })
      .mockResolvedValueOnce({
        result: {
          verdict: 'spam' as const,
          confidence: 0.97,
          reasons: ['scam'] as string[],
          riskSignals: ['wallet'] as string[],
        },
        modelUsed: 'cx/gpt-5.5',
        attempts: 1,
      });

    const decisions: unknown[] = [];
    const deps = {
      config: { accounts: [account('one')], ...baseConfig },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        getLatestBrief: async () => null,
        createPendingReview: async () => 10,
        markProcessed: async () => undefined,
        resolveReview: async () => undefined,
        recordDecision: async (input: unknown) => {
          decisions.push(input);
        },
      },
      mail: { moveToTrash: async () => undefined },
      telegram: { sendMessage: async () => undefined },
    } as unknown as ProcessDeps;

    await processMessage(deps, account('one'), {
      uid: 5,
      from: 'x@evil.test',
      subject: 's',
      text: 'b',
    });

    expect(decisions).toHaveLength(1);
    const d = decisions[0] as Record<string, unknown>;
    expect(d.outcome).toBe('auto_trashed');
    expect(d.model).toBe('minimax/MiniMax-M3');
    expect(d.verifyModel).toBe('cx/gpt-5.5');
    expect(d.reasons).toEqual(['phishing']);
    expect(d.riskSignals).toEqual(['link']);
  });

  it('records would_trash under dryRun, still resolves review', async () => {
    shouldAutoQuarantineMock.mockReturnValue(true);
    const processedActions: string[] = [];
    const resolvedIds: number[] = [];

    const deps = {
      config: {
        accounts: [account('one')],
        ...baseConfig,
        dryRun: true,
      },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        getLatestBrief: async () => null,
        createPendingReview: async () => 56,
        markProcessed: async (_slug: string, _uid: number, action: string) => {
          processedActions.push(action);
        },
        resolveReview: async (id: number) => {
          resolvedIds.push(id);
        },
        recordDecision: async () => undefined,
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

describe('mail guardian processMessage — kept branch records kept', () => {
  it('records outcome kept with classification and verification data', async () => {
    shouldKeepInInboxMock.mockReturnValue(true);
    classifyWithFallbackMock
      .mockResolvedValueOnce({
        result: {
          verdict: 'not_spam' as const,
          confidence: 0.95,
          reasons: [] as string[],
          riskSignals: [] as string[],
        },
        modelUsed: 'minimax/MiniMax-M3',
        attempts: 1,
      })
      .mockResolvedValueOnce({
        result: {
          verdict: 'not_spam' as const,
          confidence: 0.93,
          reasons: [] as string[],
          riskSignals: [] as string[],
        },
        modelUsed: 'cx/gpt-5.5',
        attempts: 1,
      });

    const decisions: unknown[] = [];
    const deps = {
      config: { accounts: [account('one')], ...baseConfig },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        getLatestBrief: async () => null,
        markProcessed: async () => undefined,
        recordDecision: async (input: unknown) => {
          decisions.push(input);
        },
      },
      mail: {},
      telegram: { sendMessage: async () => undefined },
    } as unknown as ProcessDeps;

    const result = await processMessage(deps, account('one'), {
      uid: 6,
      from: 'friend@good.test',
      subject: 'lunch',
      text: 'see you',
    });

    expect(result).toBe('kept');
    expect(decisions).toHaveLength(1);
    const d = decisions[0] as Record<string, unknown>;
    expect(d.outcome).toBe('kept');
    expect(d.model).toBe('minimax/MiniMax-M3');
    expect(d.verifyModel).toBe('cx/gpt-5.5');
  });
});

describe('mail guardian processMessage — classify_failed dead-letter', () => {
  it('stores classify_failed and returns review when classification throws', async () => {
    classifyWithFallbackMock.mockRejectedValueOnce(new Error('model error'));
    const processedActions: string[] = [];
    const decisions: unknown[] = [];

    const deps = {
      config: {
        accounts: [account('one')],
        ...baseConfig,
      },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        getLatestBrief: async () => null,
        createPendingReview: async () => 77,
        markProcessed: async (_slug: string, _uid: number, action: string) => {
          processedActions.push(action);
        },
        recordDecision: async (input: unknown) => {
          decisions.push(input);
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
    expect(decisions).toHaveLength(1);
    const d = decisions[0] as Record<string, unknown>;
    expect(d.outcome).toBe('pending');
    expect(d.model).toBeNull();
    expect(d.verdict).toBeNull();
  });

  it('stores classify_failed and returns review when verification throws', async () => {
    classifyWithFallbackMock
      .mockResolvedValueOnce({
        result: {
          verdict: 'spam' as const,
          confidence: 0.99,
          reasons: [] as string[],
          riskSignals: [] as string[],
        },
        modelUsed: 'primary',
        attempts: 1,
      })
      .mockRejectedValueOnce(new Error('verify error'));
    const processedActions: string[] = [];
    const decisions: unknown[] = [];

    const deps = {
      config: {
        accounts: [account('one')],
        ...baseConfig,
      },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        getLatestBrief: async () => null,
        createPendingReview: async () => 78,
        markProcessed: async (_slug: string, _uid: number, action: string) => {
          processedActions.push(action);
        },
        recordDecision: async (input: unknown) => {
          decisions.push(input);
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
    expect(decisions).toHaveLength(1);
    const d = decisions[0] as Record<string, unknown>;
    expect(d.outcome).toBe('pending');
  });
});

describe('mail guardian processMessage — review path records pending', () => {
  it('records outcome pending for regular uncertain review', async () => {
    classifyWithFallbackMock
      .mockResolvedValueOnce({
        result: {
          verdict: 'uncertain' as const,
          confidence: 0.5,
          reasons: [] as string[],
          riskSignals: [] as string[],
        },
        modelUsed: 'minimax/MiniMax-M3',
        attempts: 1,
      })
      .mockResolvedValueOnce({
        result: {
          verdict: 'uncertain' as const,
          confidence: 0.5,
          reasons: [] as string[],
          riskSignals: [] as string[],
        },
        modelUsed: 'cx/gpt-5.5',
        attempts: 1,
      });
    const decisions: unknown[] = [];
    const deps = {
      config: { accounts: [account('one')], ...baseConfig },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        getLatestBrief: async () => null,
        createPendingReview: async () => 88,
        markProcessed: async () => undefined,
        recordDecision: async (input: unknown) => {
          decisions.push(input);
        },
      },
      mail: { moveToReview: async () => undefined },
      telegram: { sendMessage: async () => undefined },
    } as unknown as ProcessDeps;

    const result = await processMessage(deps, account('one'), {
      uid: 15,
      from: 'x@y.test',
      subject: 'test',
      text: 'body',
    });

    expect(result).toBe('review');
    expect(decisions).toHaveLength(1);
    const d = decisions[0] as Record<string, unknown>;
    expect(d.outcome).toBe('pending');
    expect(d.model).toBe('minimax/MiniMax-M3');
  });
});

describe('mail guardian processMessage — cross-model call signatures', () => {
  it('classifies with primary+fallback and verifies with fallback+null, no feedbackSummary', async () => {
    const deps = {
      config: {
        accounts: [account('one')],
        ...baseConfig,
        dryRun: true,
      },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        getLatestBrief: async () => null,
        createPendingReview: async () => 99,
        markProcessed: async () => undefined,
        recordDecision: async () => undefined,
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

    const [classifyPrimary, classifyFallback, classifyInput] = classifyWithFallbackMock.mock
      .calls[0] as [{ model: string }, { model: string } | null, Record<string, unknown>];
    expect(classifyPrimary.model).toBe('minimax/MiniMax-M3');
    expect(classifyFallback?.model).toBe('cx/gpt-5.5');
    expect(classifyInput).not.toHaveProperty('feedbackSummary');

    const [verifyPrimary, verifyFallback, verifyInput] = classifyWithFallbackMock.mock.calls[1] as [
      { model: string },
      null,
      Record<string, unknown>,
    ];
    expect(verifyPrimary.model).toBe('cx/gpt-5.5');
    expect(verifyFallback).toBeNull();
    expect(verifyInput).not.toHaveProperty('feedbackSummary');
  });
});

describe('mail guardian processMessage — feedbackSummary injection', () => {
  it('passes feedbackSummary from getLatestBrief to both classify and verify calls', async () => {
    const deps = {
      config: { accounts: [account('one')], ...baseConfig, dryRun: true },
      store: {
        hasProcessed: async () => false,
        findRules: async () => [],
        hasAllowRule: async () => false,
        getLatestBrief: async () => ({
          id: 1,
          brief: 'owner keeps transactional email',
          source_decisions: 5,
          generated_at: new Date(),
        }),
        createPendingReview: async () => 44,
        markProcessed: async () => undefined,
        recordDecision: async () => undefined,
      },
      mail: { moveToReview: async () => undefined },
      telegram: { sendMessage: async () => undefined },
    } as unknown as ProcessDeps;

    await processMessage(deps, account('one'), {
      uid: 30,
      from: 'x@y.test',
      subject: 'test',
      text: 'body',
    });

    expect(classifyWithFallbackMock).toHaveBeenCalledTimes(2);
    const [, , classifyInput] = classifyWithFallbackMock.mock.calls[0] as [
      unknown,
      unknown,
      Record<string, unknown>,
    ];
    expect(classifyInput.feedbackSummary).toBe('owner keeps transactional email');
    const [, , verifyInput] = classifyWithFallbackMock.mock.calls[1] as [
      unknown,
      unknown,
      Record<string, unknown>,
    ];
    expect(verifyInput.feedbackSummary).toBe('owner keeps transactional email');
  });
});

describe('mail guardian applyReviewDecision — domain block proposal', () => {
  it('sends domain block proposal when spam >= 3 and no allow or existing domain rule', async () => {
    const sentMessages: unknown[][] = [];
    const deps = {
      config: {
        accounts: [account('one')],
        dryRun: false,
        telegramBotToken: 'test-token',
        telegramOwnerChatId: '777',
      },
      store: {
        getReview: async () => ({
          id: 10,
          account_slug: 'one',
          message_uid: 200,
          message_id: null,
          from_hash: 'fh',
          domain_hash: 'bulk-domain-hash',
        }),
        addRule: async () => undefined,
        markProcessed: async () => undefined,
        updateDecisionOutcome: async () => undefined,
        resolveReview: async () => undefined,
        countDomainOutcomes: async () => ({ spam: 3, allow: 0 }),
        hasRule: async () => false,
      },
      mail: { moveToTrash: async () => undefined },
      telegram: {
        sendMessage: async (...args: unknown[]) => {
          sentMessages.push(args);
        },
      },
    } as unknown as ProcessDeps;

    await applyReviewDecision(deps, 10, 'spam', 'telegram');

    expect(sentMessages).toHaveLength(1);
    const [chatId, , markup] = sentMessages[0] as [
      string,
      string,
      { inline_keyboard: { callback_data: string; text: string }[][] },
    ];
    expect(chatId).toBe('777');
    const buttons = markup.inline_keyboard.flat();
    expect(buttons.find((b) => b.callback_data === 'mgdom:10:block')).toBeDefined();
    expect(buttons.find((b) => b.callback_data === 'mgdom:10:skip')).toBeDefined();
  });

  it('does not send proposal when spam count is below threshold', async () => {
    const sentMessages: unknown[][] = [];
    const deps = {
      config: {
        accounts: [account('one')],
        dryRun: false,
        telegramBotToken: 'test-token',
        telegramOwnerChatId: '777',
      },
      store: {
        getReview: async () => ({
          id: 11,
          account_slug: 'one',
          message_uid: 201,
          message_id: null,
          from_hash: 'fh',
          domain_hash: 'rare-domain',
        }),
        addRule: async () => undefined,
        markProcessed: async () => undefined,
        updateDecisionOutcome: async () => undefined,
        resolveReview: async () => undefined,
        countDomainOutcomes: async () => ({ spam: 2, allow: 0 }),
        hasRule: async () => false,
      },
      mail: { moveToTrash: async () => undefined },
      telegram: {
        sendMessage: async (...args: unknown[]) => {
          sentMessages.push(args);
        },
      },
    } as unknown as ProcessDeps;

    await applyReviewDecision(deps, 11, 'spam', 'telegram');

    expect(sentMessages).toHaveLength(0);
  });

  it('does not send proposal when domain has any allow outcomes', async () => {
    const sentMessages: unknown[][] = [];
    const deps = {
      config: {
        accounts: [account('one')],
        dryRun: false,
        telegramBotToken: 'test-token',
        telegramOwnerChatId: '777',
      },
      store: {
        getReview: async () => ({
          id: 12,
          account_slug: 'one',
          message_uid: 202,
          message_id: null,
          from_hash: 'fh',
          domain_hash: 'mixed-domain',
        }),
        addRule: async () => undefined,
        markProcessed: async () => undefined,
        updateDecisionOutcome: async () => undefined,
        resolveReview: async () => undefined,
        countDomainOutcomes: async () => ({ spam: 5, allow: 1 }),
        hasRule: async () => false,
      },
      mail: { moveToTrash: async () => undefined },
      telegram: {
        sendMessage: async (...args: unknown[]) => {
          sentMessages.push(args);
        },
      },
    } as unknown as ProcessDeps;

    await applyReviewDecision(deps, 12, 'spam', 'telegram');

    expect(sentMessages).toHaveLength(0);
  });

  it('does not send proposal when a domain block rule already exists', async () => {
    const sentMessages: unknown[][] = [];
    const deps = {
      config: {
        accounts: [account('one')],
        dryRun: false,
        telegramBotToken: 'test-token',
        telegramOwnerChatId: '777',
      },
      store: {
        getReview: async () => ({
          id: 13,
          account_slug: 'one',
          message_uid: 203,
          message_id: null,
          from_hash: 'fh',
          domain_hash: 'already-blocked-domain',
        }),
        addRule: async () => undefined,
        markProcessed: async () => undefined,
        updateDecisionOutcome: async () => undefined,
        resolveReview: async () => undefined,
        countDomainOutcomes: async () => ({ spam: 5, allow: 0 }),
        hasRule: async (_ruleType: string, scope: string) => scope === 'domain',
      },
      mail: { moveToTrash: async () => undefined },
      telegram: {
        sendMessage: async (...args: unknown[]) => {
          sentMessages.push(args);
        },
      },
    } as unknown as ProcessDeps;

    await applyReviewDecision(deps, 13, 'spam', 'telegram');

    expect(sentMessages).toHaveLength(0);
  });

  it('does not send proposal for keep or allow_sender decisions', async () => {
    const sentMessages: unknown[][] = [];
    const mkDeps = (reviewId: number, uid: number) =>
      ({
        config: {
          accounts: [account('one')],
          dryRun: false,
          telegramBotToken: 'test-token',
          telegramOwnerChatId: '777',
        },
        store: {
          getReview: async () => ({
            id: reviewId,
            account_slug: 'one',
            message_uid: uid,
            message_id: null,
            from_hash: 'fh',
            domain_hash: 'keep-domain',
          }),
          addRule: async () => undefined,
          markProcessed: async () => undefined,
          updateDecisionOutcome: async () => undefined,
          resolveReview: async () => undefined,
        },
        mail: { moveToInbox: async () => undefined },
        telegram: {
          sendMessage: async (...args: unknown[]) => {
            sentMessages.push(args);
          },
        },
      }) as unknown as ProcessDeps;

    await applyReviewDecision(mkDeps(14, 204), 14, 'keep', 'telegram');
    await applyReviewDecision(mkDeps(15, 205), 15, 'allow_sender', 'telegram');

    expect(sentMessages).toHaveLength(0);
  });
});

describe('mail guardian handleTelegramUpdates — mgdom callbacks', () => {
  it('blocks a domain when mgdom:id:block callback arrives', async () => {
    const rules: { ruleType: string; scope: string; valueHash: string }[] = [];
    const answers: string[] = [];
    const deps = {
      config: { accounts: [account('one')], dryRun: false },
      store: {
        getReviewDomainHash: async () => 'bulk-domain-hash-2',
        addRule: async (ruleType: string, scope: string, valueHash: string) => {
          rules.push({ ruleType, scope, valueHash });
        },
      },
      telegram: {
        answerCallbackQuery: async (_id: string, text: string) => {
          answers.push(text);
        },
      },
    } as unknown as ProcessDeps;

    const update = {
      update_id: 1,
      callback_query: { id: 'cq-1', data: 'mgdom:42:block', message: { chat: { id: 777 } } },
    };

    const handled = await handleTelegramUpdates(deps, [update]);

    expect(handled).toBe(1);
    expect(rules).toEqual([
      { ruleType: 'block', scope: 'domain', valueHash: 'bulk-domain-hash-2' },
    ]);
    expect(answers).toEqual(['Domain blocked.']);
  });

  it('dismisses domain proposal and answers on mgdom:id:skip callback', async () => {
    const rules: unknown[] = [];
    const answers: string[] = [];
    const deps = {
      config: { accounts: [account('one')], dryRun: false },
      store: {
        getReviewDomainHash: async () => 'skip-domain-hash-unique',
        addRule: async (...args: unknown[]) => {
          rules.push(args);
        },
      },
      telegram: {
        answerCallbackQuery: async (_id: string, text: string) => {
          answers.push(text);
        },
      },
    } as unknown as ProcessDeps;

    const update = {
      update_id: 2,
      callback_query: { id: 'cq-2', data: 'mgdom:43:skip', message: { chat: { id: 777 } } },
    };

    const handled = await handleTelegramUpdates(deps, [update]);

    expect(handled).toBe(1);
    expect(rules).toHaveLength(0);
    expect(answers).toEqual(['Domain proposal dismissed.']);
  });

  it('answers Proposal expired when review id not found for mgdom:block', async () => {
    const answers: string[] = [];
    const deps = {
      config: { accounts: [account('one')], dryRun: false },
      store: {
        getReviewDomainHash: async () => null,
        addRule: async () => undefined,
      },
      telegram: {
        answerCallbackQuery: async (_id: string, text: string) => {
          answers.push(text);
        },
      },
    } as unknown as ProcessDeps;

    const update = {
      update_id: 3,
      callback_query: { id: 'cq-3', data: 'mgdom:999:block', message: { chat: { id: 777 } } },
    };

    await handleTelegramUpdates(deps, [update]);

    expect(answers).toEqual(['Proposal expired.']);
  });
});
