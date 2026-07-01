import { describe, expect, it, vi } from 'vitest';

const generateObjectMock = vi.fn();
const createOpenAIMock = vi.fn(() => (model) => ({ modelId: model }));
vi.mock('ai', () => ({
  generateObject: (...args) => generateObjectMock(...args),
}));
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: (...args) => createOpenAIMock(...args),
}));
const { classifyEmail, shouldAutoQuarantine } = await import('../src/model.js');
const modelConfig = {
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'test-key',
  model: 'gpt-4o-mini',
  timeoutMs: 5_000,
};
describe('model decisions', () => {
  it('auto-quarantines only when classifier and verifier meet threshold', () => {
    const classification = {
      verdict: 'spam',
      confidence: 0.96,
      reasons: ['scam'],
      riskSignals: [],
    };
    const verification = {
      verdict: 'spam',
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
    const call = generateObjectMock.mock.calls[0][0];
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
//# sourceMappingURL=model.test.js.map
