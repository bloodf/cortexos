/**
 * Server-boot runtime hooks — the single place run-once side effects are
 * registered when the Node server starts (NOT per-request).
 *
 * Invoked exactly once from `src/start.ts` (the `createStart` factory runs at
 * server init). Idempotent via the `booted` guard so it is safe even if called
 * more than once.
 *
 * Extension point (WP-10): start the periodic health scheduler here, e.g.
 *   import { startHealthScheduler } from "./health/scheduler";
 *   startHealthScheduler();
 * Do not add that import until WP-10 lands `src/server/health/scheduler.ts`,
 * so this WP's build stays green.
 */

let booted = false;

/** Run-once server boot hook. Safe to call multiple times. */
export function bootRuntime(): void {
  if (booted) return;
  booted = true;
  // WP-10 wires startHealthScheduler() here.
}
