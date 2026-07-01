import { describe, expect, it, vi } from 'vitest';

const { distillWithDeps } = await import('../src/index.js');

describe('mail guardian distill CLI dispatch', () => {
  it('writes mail_guardian_distill event to stdout and exits 0', async () => {
    let capturedOutput = '';
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: unknown) => {
      capturedOutput += String(chunk);
      return true;
    };

    const stubResult = { sourceDecisions: 3, briefChars: 42 };
    const stubDistillBrief = vi.fn(async () => stubResult);

    const fakeDeps = {
      config: {
        model: 'gpt-4o-mini',
        openAiBaseUrl: 'http://localhost',
        openAiApiKey: 'k',
        dryRun: false,
        accounts: [],
      },
      store: {},
      mail: {},
      telegram: {},
    } as never;

    try {
      await distillWithDeps(fakeDeps, stubDistillBrief);
    } finally {
      process.stdout.write = origWrite;
    }

    expect(stubDistillBrief).toHaveBeenCalledWith(fakeDeps);
    expect(capturedOutput).toContain('"event":"mail_guardian_distill"');
    expect(capturedOutput).toContain('"sourceDecisions":3');
    expect(capturedOutput).toContain('"briefChars":42');
  });
});
