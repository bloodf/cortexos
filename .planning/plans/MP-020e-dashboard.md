# MP-020e — dashboard-next → 0 findings + legacy redirect-disable removal

Implementer: kimi. Repo root: /opt/cortexos. Report (append after EVERY
file): `/opt/cortexos/.planning/harness/artifacts/impl-mp-020e-report.md`
Manifest input: `artifacts/recon-mp020-manifest.md` (§3c/d/e/g rows).
Scope: dashboard-next 24 findings + removal of the 12 legacy
only-throw-error disables. LIVE released product — checkpoint protocol
applies; one file (or atomic group) at a time, parse-check each.

HANDS-OFF caveat history: src/mocks/drift.ts and
src/server/db/__tests__/client.test.ts each broke twice under broad
edits — this plan touches them with EXACT single-purpose changes only.

## Tasks
1. RED: quote `pnpm exec eslint packages/dashboard-next 2>&1 | tail -1`
   (expect 24).
2. no-await-in-loop ×12: add
   `packages/dashboard-next/src/lib/sequential.ts` (`runSequentially`,
   reduce-chain, lint-clean body) and convert per manifest rows. The
   health scheduler / migration / test loops are ORDER-DEPENDENT —
   sequencing preserved by construction; quote each before/after.
   (db/migrate.ts loop: the SQL files MUST apply in lexical order — the
   conversion maps the sorted array through runSequentially.)
3. no-underscore-dangle ×5 (exported test hooks): ATOMIC RENAME GROUPS —
   for each hook: grep ALL references first
   (`grep -rn '<name>' packages/`), then edit module + every importer +
   test pair consecutively; `_x` → `xForTests`. tsc after EACH group.
4. no-bitwise ×4 (seed.ts, lovable-error-reporting.ts):
   a. FIRST write golden tests: for each hash function capture current
      outputs for ≥8 representative inputs (incl. empty string, unicode,
      long string) into a new test file asserting exact values. Run —
      green against the CURRENT implementation.
   b. THEN rewrite without bitwise operators: `x | 0` int32 wraps →
      `Math.imul(x, 1)`; `h << 5` → `Math.imul(h, 32)`; `>>> 0`
      (to-unsigned) → `(h % 0x100000000 + 0x100000000) % 0x100000000`;
      compose per site so outputs are bit-identical.
   c. Golden tests still green = proof. Quote.
5. prefer-arrow-callback ×1 (client.test.ts:18): hoist a NAMED function
   declaration `function MockPool(...) { return mockPool; }` above the
   mock setup and pass the reference — `new`-able, lint-clean. ONLY this
   change in this file. Run the db client test scope immediately.
6. no-unnecessary-type-assertion ×1 (drift.ts:97): give the literal an
   explicit type annotation (or `satisfies`) such that the assertion
   deletes cleanly AND `tsc --noEmit` stays 0. ONLY this change in this
   file. tsc immediately after.
7. import-x/no-extraneous-dependencies ×1: per manifest §3c — correct
   the manifest section or import; if it is a scripts/** file the
   MP-020b scope already covers it (then this finding is gone by then —
   re-verify, report).
8. Legacy redirect disables (12): per manifest §3d add the missing allow
   entry(ies) to the existing `@typescript-eslint/only-throw-error`
   config (e.g. a second `{ from: 'package', name: 'Redirect', package:
   '<actual source pkg>' }`), verify
   `pnpm exec eslint packages/dashboard-next | grep -c only-throw-error`
   → 0 WITHOUT the comments, then DELETE all 12
   `eslint-disable-next-line @typescript-eslint/only-throw-error` lines.
   Then assert zero unused-directive warnings.
9. GREEN: scope eslint → 0 (quote); zero added disables; the 12 legacy
   ones REMOVED (`grep -rc 'only-throw-error' src/ | grep -v ':0'` →
   empty).
10. Gates: tsc --noEmit 0; full suite (env sourced from
    /opt/cortexos/.secrets/dashboard.env) zero failures — note the
    golden tests RAISE the total above 558, quote new total;
    `pnpm --filter @cortexos/dashboard-next build` exit 0;
    format:check exit 0.
11. ONE commit (checkpoints on death, same message + part N):
    `fix(lint): MP-020e — dashboard-next to zero; legacy redirect disables removed`
    Do NOT stage .planning/**. NEVER push.
End IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: scope 0; repo drops by exactly 24; golden tests prove hash
  outputs bit-identical.
- A2: zero added disables; 12 legacy disables gone; ≤1 config edit
  (the only-throw-error allow extension, `// MP-020:` commented).
- A3: gates green incl. raised test total.
