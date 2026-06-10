# MP-012 — post-release polish: dead surface member + two accepted MINORs + stale comment

## Requirements (all previously logged in `.planning/GATE-RESOLUTION.md`)
- MP12-R1: remove the dead `"root-helper"` member from the `Surface` union
  (`packages/dashboard-next/src/server/policy/index.ts:35`). Evidence it
  is dead: `recon-root-helper.md` verdict ORPHANED-LEGACY (zero allowlist
  entries, no socket client; host units stopped+disabled); orchestrator
  grep 2026-06-10 shows the only source references are the union member
  itself and the stale comment in MP12-R2's file. Absence after the edit
  is proven by the tree-wide grep in Task 3 (not by tsc alone — tsc only
  guards typed references; the grep covers strings/comments).
- MP12-R2: fix the stale doc comment at
  `packages/dashboard-next/src/server/db/repos/dashboard_command_audit.ts:8`
  referencing the deleted legacy path `lib/root-helper/executor.ts` —
  reword to describe the table's purpose without the dead pointer.
- MP12-R3 (MP-002 kimi-gate MINOR, "accepted as logged debt" — recorded in
  `.planning/GATE-RESOLUTION.md`, "MP-002 implementation gates" section,
  embedded in this gate run): drop the redundant `& { inputData?: TIn }`
  intersection on `runServerFnGate`
  (`packages/dashboard-next/src/lib/api/server-fn-runner.server.ts:23`) —
  `RouteOptions` already declares `inputData?: TIn` at
  `packages/dashboard-next/src/server/server-fn-pipeline.ts:97` (file
  embedded in this gate run).
- MP12-R4 (the other MP-002 MINOR): correct the stale "excess-property
  check" comment at
  `packages/dashboard-next/src/lib/api/__tests__/mp-002-get-input.test.ts:76`
  (verified: `grep -n 'excess-property'` → :76; the kimi gate's original
  ":46" cite was approximate). inputData is a declared RouteOptions
  property, so no excess-property error is possible.
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
   the stale phrases); tree-wide absence:
   `grep -rn 'root-helper' packages/dashboard-next/src --include='*.ts' --include='*.tsx' | wc -l` → 0;
   gates: `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit`
   exit 0; `pnpm --filter @cortexos/dashboard-next exec eslint . ; echo "lint-exit=$?"`
   → lint-exit=0; full suite:
   `bash -c 'set -a; source /opt/cortexos/.secrets/dashboard.env; set +a; cd packages/dashboard-next && pnpm exec vitest run'`
   → zero failures, ≥ 558 tests; build:
   `pnpm --filter @cortexos/dashboard-next build` → exit 0. Quote all.
4. ONE commit of exactly the four files, message:
   chore(dashboard-next): post-release polish — drop dead root-helper surface, MP-002 MINORs, stale comments (MP-012)
   Do NOT stage .planning/**. NEVER push.
5. Acceptance summary + SHA; end IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: all Task-1 and Task-3 grep counts as stated; all four gates quoted
  green.
- A2: `git diff --name-only HEAD~1..HEAD` lists exactly the four owned
  files.
- A2b (zero emitted-code difference, binary): capture
  `ls packages/dashboard-next/.output/public/assets | sort > /tmp/mp012-assets-before.txt`
  BEFORE the edits (the .output present from the release build) and the
  same to `/tmp/mp012-assets-after.txt` after Task-3's build;
  `diff /tmp/mp012-assets-before.txt /tmp/mp012-assets-after.txt` → empty.
  Chunk filenames are content-hashed, so identical names ⇒ identical
  emitted client code; type/comment edits and the test file are not part
  of the bundle.
  SERVER side: record `sha256sum packages/dashboard-next/.output/server/index.mjs`
  BEFORE (orchestrator baseline 2026-06-10: `57e0e138a90b10b2…`) and AFTER
  the Task-3 build — hashes equal. If unequal (build non-determinism),
  quote `cmp -l` byte-count and the first differing context; the
  orchestrator adjudicates before push — do not self-approve a difference.
- A3 (reviewer): gpt-5.5 diff review (embedded plan+diff) PASS — kimi is
  the implementer, so gpt-5.5 reviews (author ≠ reviewer).

## Out of scope
- Any runtime logic; the policy allowlist contents; harness scripts
  (orchestrator-owned); docs/prompts historical references.
