# MP-011 — fix the 45 residual lint problems (manual, per-rule strategies)

## Requirements
- MP11-R1: after MP-010's autofix (`e85736a`), `pnpm --filter
  @cortexos/dashboard-next lint` reports 45 problems (29 errors, 16
  warnings). Rule-id inventory
  (`.planning/harness/artifacts/impl-mp-010-report.md:92-97`, residual
  table; operator approval at `.planning/GATE-RESOLUTION.md:337-343`):
  14 react-refresh/only-export-components, 13 react-hooks/rules-of-hooks,
  12 @typescript-eslint/no-explicit-any, 2 react-hooks/exhaustive-deps,
  2 no-irregular-whitespace, 2 @typescript-eslint/no-empty-object-type.
  Operator approved finishing the lint debt (GATE-RESOLUTION "operator
  approvals": lint cleanup wave; this is its deferred follow-up).
- MP11-R2: behavior must not change. Guards with baselines: full suite —
  `Tests 558 passed (558)` quoted in
  `.planning/harness/artifacts/impl-mp-010-report.md` (Task-3 gate run of
  MP-010, commit `e85736a`); screen verification — 18/18 PASS, exit 0,
  `.planning/harness/artifacts/screen-defects-9.md:3-6`; plus tsc and
  build exit 0 as in every prior MP.

ALL commands run from `/opt/cortexos`.

## File ownership
- Files under `packages/dashboard-next/src/` that the Task-1 listing names
  as carrying one of the 45 problems; PLUS, for the
  only-export-components moves: any NEW sibling module created to receive
  a moved export, and the direct importers of each moved export (found via
  `grep -rn '<exportName>' packages/dashboard-next/src` and named in the
  report before editing them). Nothing else.
- Report (never committed):
  `/opt/cortexos/.planning/harness/artifacts/impl-mp-011-report.md`

## Per-rule strategies (binding)
- `react-hooks/rules-of-hooks` (13): inspect EACH occurrence first. If the
  fix is a mechanical pattern (e.g. a lowercase-named function component →
  rename/wrap so the linter recognizes it; a hook helper misnamed without
  `use` prefix → rename), apply it. If ANY occurrence is a hook genuinely
  called conditionally/in a loop inside a real component — that is a
  correctness bug: STOP, report IMPL-BLOCKED naming the file:line, do not
  improvise a restructure.
- `react-refresh/only-export-components` (14): move non-component exports
  to a sibling module (or existing appropriate module) and re-import;
  never change the exported values' behavior. Update importers.
- `@typescript-eslint/no-explicit-any` (12): replace `any` with the
  precise type where it is locally evident (≤5 lines of context); where
  the precise type is not locally evident, use `unknown` + a narrow cast
  at the use site. NO `any` may remain in the touched lines.
- `react-hooks/exhaustive-deps` (2): add the missing deps ONLY if doing so
  cannot change behavior (pure values); otherwise wrap the value in
  useCallback/useMemo at its definition. If either fix would alter effect
  timing in a way tests don't cover, STOP and report that occurrence.
- `no-irregular-whitespace` (2) and `no-empty-object-type` (2):
  mechanical (replace the character; replace `{}` with the intended type
  — `object`, `Record<string, never>`, or a named interface).

## Tasks (append to the report after EVERY step)
1. LISTING: `pnpm --filter @cortexos/dashboard-next exec eslint . > /tmp/mp011-listing.txt 2>&1; cat /tmp/mp011-listing.txt`
   — quote the COMPLETE unfiltered output in the report (stylish format
   keeps filenames as header lines; 45 problems is small enough to quote
   whole). This is the ownership list.
2. Fix per the strategies above, file by file. After each file:
   `pnpm --filter @cortexos/dashboard-next exec eslint <file>` clean of
   the targeted rules.
3. Gates: lint = `pnpm --filter @cortexos/dashboard-next exec eslint . ; echo "lint-exit=$?"`.
   FULL-FIX outcome: `lint-exit=0`, no problem lines (eslint success is
   silent; the exit code is the binary signal — quote both). PARTIAL
   outcome: lint exit may be non-zero; the printed problems must be
   EXACTLY the escalated occurrences and nothing else (quote them).
   In BOTH outcomes: `tsc --noEmit` exit 0; full suite (env sourced, no
   NODE_ENV override) zero failures ≥ 558 tests; build exit 0. Quote all.
4. ONE commit of the touched src files. Two defined outcomes, both
   committed and gated:
   - FULL FIX (no escalations): message exactly
     `fix(dashboard-next): resolve residual lint — hooks naming, export hygiene, any-elimination (MP-011)`
   - PARTIAL (≥1 rules-of-hooks/exhaustive-deps occurrence escalated per
     the strategies): fix and commit everything else; message exactly
     `fix(dashboard-next): resolve residual lint — partial, N occurrences escalated (MP-011)`
     with N substituted; Task-3 gates run on the partial state (lint
     exit may be non-zero — quote the remaining problems, which must be
     EXACTLY the escalated occurrences and nothing else).
   Do NOT stage .planning/**. NEVER push.
5. Acceptance summary + commit SHA; end IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1 (binary in both outcomes): Task-1 listing quoted. FULL FIX: final
  lint exits 0 with no problem lines, report ends IMPL-COMPLETE. PARTIAL:
  final lint output's remaining problems are exactly the escalated
  occurrences (file:line-matched against the strategies' STOP cases),
  report ends IMPL-BLOCKED naming them, and the partial commit exists per
  Task 4.
- A2: tsc exit 0; full suite zero failures ≥ 558; build exit 0.
- A3 (ownership, binary): `git diff --name-only HEAD~1..HEAD | grep -vc '^packages/dashboard-next/src/'`
  → 0; AND the report quotes the full `git diff --name-only HEAD~1..HEAD`
  list with a provenance tag per path — `[listing]` (appears in the Task-1
  output), `[importer:<exportName>]` (named importer of a moved export),
  or `[new-module]` (sibling created for moved exports). Any path without
  one of those three tags fails this criterion. No suppression comments
  added (`git diff HEAD~1..HEAD | grep -cE '^\+.*(eslint-disable|eslint-enable|eslint-env|/\* *global )'` → 0).
- A4 (orchestrator): post-deploy screen verification 18/18 PASS.

## Out of scope
- eslint config/rule changes, suppressions, new dependencies.
- Restructuring components beyond the named mechanical patterns.
- The dead `root-helper` Surface union member (separate note, not lint).
