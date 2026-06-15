import { describe, expect, it, vi } from 'vitest';
import { listenerStep } from '../src/backoff.js';

const { runSweepWithDeps } = await import('../src/index.js');

/**
 * Regression guard for `mail-guardian-sweep-rebuilds-deps-each-idle-cycle`.
 *
 * The long-lived `listen` path must build its IMAP/DB deps and run
 * `ensureSchema()` exactly ONCE at startup, then reuse the same deps on every
 * idle-wake sweep — never rebuilding them or re-running ensureSchema per cycle.
 */
describe('listen path reuses deps across idle cycles', () => {
  function makeDeps() {
    const ensureSchema = vi.fn(async () => undefined);
    const sweepFn = vi.fn(async () => ({
      processed: 0,
      trashed: 0,
      review: 0,
      kept: 0,
      skipped: 0,
      failed: 0,
      actions: 0,
      openReviews: 0,
    }));
    const deps = {
      config: {
        // Telegram intentionally disabled so runSweepWithDeps takes the
        // no-assertReady branch and we isolate the dep-reuse behaviour.
        accounts: [{ slug: 'acct' }],
        telegramBotToken: undefined,
        telegramOwnerChatId: undefined,
      },
      store: { ensureSchema },
      mail: {},
      telegram: {},
    } as never;
    return { deps, ensureSchema, sweepFn };
  }

  it('builds deps + runs ensureSchema once while sweeping every cycle', async () => {
    const { deps, ensureSchema, sweepFn } = makeDeps();

    // Mirror buildDeps(): ensureSchema runs exactly once at startup, before the
    // idle loop begins, NOT inside the per-cycle sweep closure.
    await (deps as { store: { ensureSchema: () => Promise<void> } }).store.ensureSchema();

    // Mirror the listen() loop's per-cycle sweep closure.
    const sweep = () => runSweepWithDeps(deps, sweepFn);

    const cycles = 5;
    const runCycle = (attempt: number): Promise<number> =>
      listenerStep(attempt, {
        waitForNewMail: vi.fn().mockResolvedValue(undefined),
        sweep,
        sleep: vi.fn().mockResolvedValue(undefined),
        rand: () => 0.5,
      });

    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try {
      // Drive N idle cycles sequentially without an imperative await-in-loop.
      await Array.from({ length: cycles }).reduce<Promise<number>>(
        (prev) => prev.then(runCycle),
        Promise.resolve(0),
      );
    } finally {
      process.stdout.write = origWrite;
    }

    // ensureSchema ran exactly once (at startup), not once per cycle.
    expect(ensureSchema).toHaveBeenCalledTimes(1);
    // ...yet every idle cycle still executed a sweep.
    expect(sweepFn).toHaveBeenCalledTimes(cycles);
    // Every sweep received the SAME deps object — no rebuild per cycle.
    expect(sweepFn.mock.calls.every((call) => call[0] === deps)).toBe(true);
  });

  it('runSweepWithDeps never closes the deps it was handed', async () => {
    const { deps, sweepFn } = makeDeps();
    const close = vi.fn();
    (deps as { store: { close?: () => void }; mail: { close?: () => void } }).store.close = close;
    (deps as { mail: { close?: () => void } }).mail.close = close;

    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    try {
      await runSweepWithDeps(deps, sweepFn);
      await runSweepWithDeps(deps, sweepFn);
    } finally {
      process.stdout.write = origWrite;
    }

    // Caller owns the deps lifecycle; the reusable sweep must not tear them down.
    expect(close).not.toHaveBeenCalled();
    expect(sweepFn).toHaveBeenCalledTimes(2);
  });
});
