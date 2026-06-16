import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProcessDeps } from '../src/processor.js';
import { parseRawEmail } from '../src/imap.js';
import { processMessage } from '../src/processor.js';

// Force the review path: classifier returns "uncertain" so processMessage
// stores a pending review (which is where summary + decoded body land).
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

vi.mock('../src/model.js', () => ({
  classifyWithFallback: (...args: unknown[]) => classifyWithFallbackMock(...args),
  heuristicSpamScore: () => 0,
  shouldKeepInInbox: () => false,
  shouldAutoQuarantine: () => false,
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
});

const CRLF = '\r\n';

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

interface CapturedReview {
  summary: string;
  subject?: string;
  body?: string;
}

interface CapturedClassify {
  text: string;
}

/**
 * Drive the real processor for one raw email and capture what the store
 * would have persisted (summary + decoded body) plus what the classifier
 * was actually asked to read. This is the regression that bit prod: the
 * pre-decode pipeline stored MIME/base64/QP garbage in `summary` and fed
 * the same garbage to the spam classifier.
 */
async function runReview(rawEmail: string): Promise<{
  review: CapturedReview;
  classify: CapturedClassify;
}> {
  const message = { uid: 7, ...parseRawEmail(rawEmail) };
  let captured: CapturedReview | undefined;

  const deps = {
    config: { accounts: [account('one')], ...baseConfig },
    store: {
      hasProcessed: async () => false,
      findRules: async () => [],
      hasAllowRule: async () => false,
      getLatestBrief: async () => null,
      createPendingReview: async (input: CapturedReview) => {
        captured = input;
        return 1;
      },
      markProcessed: async () => undefined,
      recordDecision: async () => undefined,
    },
    mail: { moveToReview: async () => undefined },
    telegram: { sendMessage: async () => undefined },
  } as unknown as ProcessDeps;

  const result = await processMessage(deps, account('one'), message);
  expect(result).toBe('review');
  if (!captured) throw new Error('createPendingReview was not called');

  const classifyInput = classifyWithFallbackMock.mock.calls[0]?.[2] as CapturedClassify;
  return { review: captured, classify: classifyInput };
}

function assertHumanReadable(text: string): void {
  // Negative assertions: the undecoded-MIME tells that prod stored.
  expect(text).not.toContain('=C3=');
  expect(text).not.toContain('Content-Transfer-Encoding');
  expect(text).not.toMatch(/boundary=/i);
  expect(text).not.toContain('--B1');
}

describe('mail guardian processor decode — summary + body are human-readable', () => {
  it('(a) decodes a quoted-printable text/plain part of multipart/alternative', async () => {
    const raw = [
      'From: Café Owner <owner@example.com>',
      'Subject: Votre café est prêt',
      'Content-Type: multipart/alternative; boundary="B1"',
      '',
      '--B1',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'Bonjour, votre caf=C3=A9 co=C3=BBte =E2=82=AC10 et il est pr=C3=AAt.',
      '--B1',
      'Content-Type: text/html; charset=utf-8',
      '',
      '<p>ignored html</p>',
      '--B1--',
      '',
    ].join(CRLF);

    const { review, classify } = await runReview(raw);

    // Decoded accented chars present in both the stored body and the summary.
    expect(review.body).toContain('café');
    expect(review.body).toContain('coûte €10');
    expect(review.body).toContain('prêt');
    expect(review.summary).toContain('café');
    expect(review.summary).toContain('prêt');
    assertHumanReadable(review.summary);
    assertHumanReadable(review.body ?? '');

    // The classifier read the decoded body, not raw QP.
    expect(classify.text).toContain('café');
    assertHumanReadable(classify.text);
  });

  it('(b) decodes a base64-encoded text/plain part', async () => {
    const plain = 'Hello,\n\nYour invoice #4821 is ready for payment.\n';
    const b64 = Buffer.from(plain, 'utf8').toString('base64');
    const raw = [
      'From: Billing <billing@example.com>',
      'Subject: Invoice ready',
      'Content-Type: multipart/alternative; boundary="B1"',
      '',
      '--B1',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      b64,
      '--B1--',
      '',
    ].join(CRLF);

    const { review, classify } = await runReview(raw);

    expect(review.body).toContain('Your invoice #4821 is ready for payment.');
    expect(review.summary).toContain('invoice');
    expect(review.summary).toContain('ready');
    // The raw base64 blob must NOT survive into the summary or body.
    expect(review.summary).not.toContain(b64);
    expect(review.body).not.toContain(b64);
    assertHumanReadable(review.summary);
    assertHumanReadable(review.body ?? '');

    expect(classify.text).toContain('invoice');
    expect(classify.text).not.toContain(b64);
  });

  it('(c) leaves a plain 7bit body unchanged (control)', async () => {
    const raw = [
      'From: Friend <friend@good.test>',
      'Subject: Lunch tomorrow',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Hey, are we still on for lunch tomorrow at noon?',
      '',
    ].join(CRLF);

    const { review, classify } = await runReview(raw);

    expect(review.body).toContain('lunch tomorrow at noon');
    expect(review.summary).toContain('lunch');
    expect(classify.text).toContain('lunch tomorrow at noon');
    assertHumanReadable(review.summary);
    assertHumanReadable(review.body ?? '');
  });
});
