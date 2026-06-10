# MP-012 — post-release polish: dead surface member + two accepted MINORs + stale comment

## Requirements (all previously logged in `.planning/GATE-RESOLUTION.md`)
- MP12-R1: remove the dead `"root-helper"` member from the `Surface` union
  (`packages/dashboard-next/src/server/policy/index.ts:35`). Evidence it
  is dead: `recon-root-helper.md` verdict ORPHANED-LEGACY (zero allowlist
  entries, no socket client; host units stopped+disabled); orchestrator
  grep 2026-06-10 shows the ONLY live reference is the union member
  itself. tsc will prove no other reference exists.
- MP12-R2: fix the stale doc comment at
  `packages/dashboard-next/src/server/db/repos/dashboard_command_audit.ts:8`
  referencing the deleted legacy path `lib/root-helper/executor.ts` —
  reword to describe the table's purpose without the dead pointer.
- MP12-R3 (MP-002 kimi-gate MINOR, "accepted as logged debt"): drop the
  redundant `& { inputData?: TIn }` intersection on `runServerFnGate`
  (`packages/dashboard-next/src/lib/api/server-fn-runner.server.ts:23`) —
  `RouteOptions` already declares `inputData?: TIn`
  (`src/server/server-fn-pipeline.ts:~92`).
- MP12-R4 (the other MP-002 MINOR): correct the stale "excess-property
  check" comment near
  `packages/dashboard-next/src/lib/api/__tests__/mp-002-get-input.test.ts:46`
  (inputData is a declared RouteOptions property, so no excess-property
  error is possible).
- No runtime behavior may change: every edit is a type annotation or
  comment; zero emitted-code difference expected.

ALL commands run from `/opt/cortexos`.

## File ownership (exclusive — exactly these four files)
- `packages/dashboard-next/src/server/policy/index.ts`
- `packages/dashboard-next/src/server/db/repos/dashboard_command_audit.ts`
- `packages/dashboard-next/src/lib/api/server-fn-runner.server.ts`
- `packages/dashboard-next/src/lib/api/__tests__/mp-002-get-input.test.ts`
- Report (never committed):
  `/opt/cortexos/.planning/harness/artifacts/impl-mp-012-report.md`

## Tasks (append to the report after every step)
1. RED-equivalents (quote each): `grep -c '"root-helper"' packages/dashboard-next/src/server/policy/index.ts` → 1;
   `grep -c 'root-helper' packages/dashboard-next/src/server/db/repos/dashboard_command_audit.ts` ≥ 1;
   `grep -c '& { inputData' packages/dashboard-next/src/lib/api/server-fn-runner.server.ts` → 1;
   `grep -c 'excess-property' packages/dashboard-next/src/lib/api/__tests__/mp-002-get-input.test.ts` ≥ 1.
2. Apply the four edits per MP12-R1..R4.
3. GREEN: re-run all four greps → 0 (for the comment fixes: zero matches of
   the stale phrases); gates: `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit`
   exit 0; `pnpm --filter @cortexos/dashboard-next exec eslint . ; echo "lint-exit=$?"`
   → lint-exit=0; full suite (env sourced, no NODE_ENV override) zero
   failures ≥ 558; build exit 0. Quote all.
4. ONE commit of exactly the four files, message:
   chore(dashboard-next): post-release polish — drop dead root-helper surface, MP-002 MINORs, stale comments (MP-012)
   Do NOT stage .planning/**. NEVER push.
5. Acceptance summary + SHA; end IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: all Task-1 and Task-3 grep counts as stated; all four gates quoted
  green.
- A2: `git diff --name-only HEAD~1..HEAD` lists exactly the four owned
  files.
- A3 (reviewer): gpt-5.5 diff review (embedded plan+diff) PASS — kimi is
  the implementer, so gpt-5.5 reviews (author ≠ reviewer).

## Out of scope
- Any runtime logic; the policy allowlist contents; harness scripts
  (orchestrator-owned); docs/prompts historical references.
