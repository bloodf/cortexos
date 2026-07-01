import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateObjectMock = vi.fn();
const createOpenAIMock = vi.fn(() => (model: string) => ({ modelId: model }));

vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: (...args: unknown[]) => createOpenAIMock(...args),
}));

const { classifyEmail, classifyWithFallback, shouldAutoQuarantine } = await import(
  '../src/model.js'
);

const modelConfig = {
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'test-key',
  model: 'gpt-4o-mini',
  timeoutMs: 5_000,
};

const fallbackConfig = {
  ...modelConfig,
  model: 'gpt-4o',
};

const sampleInput = {
  from: 'test@example.com',
  subject: 'test',
  text: 'hello',
};

beforeEach(() => {
  generateObjectMock.mockReset();
  createOpenAIMock.mockClear();
});

describe('model decisions', () => {
  it('auto-quarantines only when classifier and verifier meet threshold', () => {
    const classification = {
      verdict: 'spam' as const,
      confidence: 0.96,
      reasons: ['scam'],
      riskSignals: [],
    };
    const verification = {
      verdict: 'spam' as const,
      confidence: 0.95,
      reasons: ['phishing'],
      riskSignals: [],
    };
    expect(
      shouldAutoQuarantine({ classification, verification, threshold: 0.95, hasAllowRule: false }),
    ).toBe(true);
    expect(
      shouldAutoQuarantine({ classification, verification, threshold: 0.97, hasAllowRule: false }),
    ).toBe(false);
    expect(
      shouldAutoQuarantine({ classification, verification, threshold: 0.95, hasAllowRule: true }),
    ).toBe(false);
  });
});

describe('classifyEmail (Vercel AI SDK wiring)', () => {
  it('configures the OpenAI-compatible client and returns normalized output', async () => {
    generateObjectMock.mockReset();
    createOpenAIMock.mockClear();
    generateObjectMock.mockResolvedValue({
      object: { verdict: 'ham', confidence: 0.88, reasons: ['expected'], riskSignals: [] },
    });

    const result = await classifyEmail(modelConfig, {
      from: 'friend@example.com',
      subject: 'lunch',
      text: 'see you at noon',
    });

    expect(createOpenAIMock).toHaveBeenCalledWith({
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'test-key',
    });
    const call = generateObjectMock.mock.calls[0][0] as {
      model: unknown;
      schema: unknown;
      abortSignal: unknown;
    };
    expect(call.model).toEqual({ modelId: 'gpt-4o-mini' });
    expect(call.abortSignal).toBeInstanceOf(AbortSignal);
    expect(result.verdict).toBe('not_spam');
    expect(result.confidence).toBe(0.88);
  });

  it('passes a spam verdict straight through', async () => {
    generateObjectMock.mockReset();
    generateObjectMock.mockResolvedValue({
      object: {
        verdict: 'spam',
        confidence: 0.99,
        reasons: ['phishing'],
        riskSignals: ['credential request'],
      },
    });

    const result = await classifyEmail(modelConfig, {
      from: 'noreply@scam.test',
      subject: 'verify your account',
      text: 'click here',
    });

    expect(result.verdict).toBe('spam');
    expect(result.riskSignals).toEqual(['credential request']);
  });
});

describe('classifyWithFallback', () => {
  it('returns the primary result on the first attempt when it succeeds', async () => {
    generateObjectMock.mockResolvedValue({
      object: { verdict: 'ham', confidence: 0.9, reasons: [], riskSignals: [] },
    });

    const outcome = await classifyWithFallback(modelConfig, fallbackConfig, sampleInput);

    expect(createOpenAIMock).toHaveBeenCalledTimes(1);
    expect(outcome.modelUsed).toBe(modelConfig.model);
    expect(outcome.attempts).toBe(1);
    expect(outcome.result.verdict).toBe('not_spam');
  });

  it('invokes the fallback model when the primary throws', async () => {
    generateObjectMock
      .mockRejectedValueOnce(new Error('primary attempt failed'))
      .mockResolvedValueOnce({
        object: { verdict: 'spam', confidence: 0.99, reasons: ['phishing'], riskSignals: [] },
      });

    const outcome = await classifyWithFallback(modelConfig, fallbackConfig, sampleInput);

    // Primary is attempted once, then the FALLBACK model is invoked — not a
    // second call against the primary.
    expect(createOpenAIMock).toHaveBeenCalledTimes(2);
    expect(createOpenAIMock).toHaveBeenNthCalledWith(1, {
      baseURL: modelConfig.baseUrl,
      apiKey: modelConfig.apiKey,
    });
    const secondCallModel = generateObjectMock.mock.calls[1][0] as { model: { modelId: string } };
    expect(secondCallModel.model.modelId).toBe(fallbackConfig.model);
    expect(outcome.modelUsed).toBe(fallbackConfig.model);
    expect(outcome.attempts).toBe(2);
    expect(outcome.result.verdict).toBe('spam');
  });

  it('propagates the fallback error when primary and fallback both fail', async () => {
    generateObjectMock
      .mockRejectedValueOnce(new Error('primary attempt failed'))
      .mockRejectedValueOnce(new Error('fallback failed'));

    await expect(classifyWithFallback(modelConfig, fallbackConfig, sampleInput)).rejects.toThrow(
      'fallback failed',
    );
    expect(createOpenAIMock).toHaveBeenCalledTimes(2);
    expect(generateObjectMock).toHaveBeenCalledTimes(2);
  });

  it('makes exactly two attempts and throws when no fallback is provided', async () => {
    generateObjectMock.mockRejectedValue(new Error('primary keeps failing'));

    await expect(classifyWithFallback(modelConfig, null, sampleInput)).rejects.toThrow(
      'primary keeps failing',
    );
    expect(createOpenAIMock).toHaveBeenCalledTimes(2);
    expect(generateObjectMock).toHaveBeenCalledTimes(2);
  });
});
