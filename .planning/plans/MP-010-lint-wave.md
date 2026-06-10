# MP-010 — dashboard-next lint-debt cleanup wave (autofix-first)

## Requirements
- MP10-R1: operator approved the "lint cleanup wave"
  (`.planning/GATE-RESOLUTION.md` "operator approvals" section).
  Baseline order of magnitude per the GATE-RESOLUTION G3 amendment:
  `pnpm --filter @cortexos/dashboard-next lint` reports ~11,106 problems.
  The exact current totals AND the auto-fixable share are MEASURED in
  Task 1 (eslint prints both in its summary line) — Task 3's ≥90%
  reduction criterion is evaluated against those measured numbers, not
  this paragraph.
- MP10-R2: the wave must not change behavior. Guards: the full test suite
  (`Tests 558 passed (558)` quoted in
  `.planning/harness/artifacts/impl-mp-009-report.md` for commit
  `5f93130`), `tsc --noEmit`, a production build, and the post-wave
  screen verification run.
- MP10-R3: residual (non-autofixable) problems are NOT hand-fixed in this
  wave — they get counted, categorized by rule id, and reported for a
  follow-up decision. No suppression comments, no eslint-config rule
  changes.

ALL commands run from `/opt/cortexos`.

## File ownership
- Any file under `packages/dashboard-next/` that `eslint --fix` itself
  modifies (mechanical autofix only — the implementer makes NO manual
  edits to source). No file outside `packages/dashboard-next/`.
- Report (never committed):
  `/opt/cortexos/.planning/harness/artifacts/impl-mp-010-report.md`

## Tasks (append to the report after EVERY step)
1. BASELINE: `pnpm --filter @cortexos/dashboard-next lint 2>&1 | tail -2`
   — quote the problem-count line.
2. AUTOFIX: `pnpm --filter @cortexos/dashboard-next exec eslint . --fix`
   (exit code may be non-zero — residuals remain; that is expected).
3. Re-run the Task-1 lint command — quote the new counts. Binary stop
   condition: if the reduction is less than 90% of the Task-1 baseline,
   STOP and report IMPL-BLOCKED.
4. Gates, env per established pattern
   (`set -a; source /opt/cortexos/.secrets/dashboard.env; set +a`):
   - `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit` exit 0.
   - `cd packages/dashboard-next && pnpm exec vitest run` — zero failures,
     ≥ 558 tests.
   - `pnpm --filter @cortexos/dashboard-next build` exit 0.
   Quote all three summaries.
5. RESIDUAL INVENTORY (default formatter — eslint v9 removed the core
   `unix` formatter): `pnpm --filter @cortexos/dashboard-next exec eslint . 2>&1 | awk '/error|warning/ {print $NF}' | grep -E '^[a-z0-9@]' | sort | uniq -c | sort -rn | head -15`
   (stylish output ends each finding line with the rule id as the last
   field, so ids with digits like `jsx-a11y/*` survive intact) — quote
   the table.
6. ONE commit of the autofixed files only (do NOT stage `.planning/**` or
   `.output/**`), message exactly:
   style(dashboard-next): eslint --fix wave — mechanical autofix, no manual edits (MP-010)
   NEVER push.
7. Acceptance summary + commit SHA; end IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: baseline and post-fix counts quoted; reduction ≥ 90% of baseline.
- A2: tsc exit 0; full suite zero failures with ≥ 558 tests; build exit 0.
- A3 (path-level, binary): `git show --stat HEAD | tail -1` quoted for the
  size summary, AND
  `git diff --name-only HEAD~1..HEAD | grep -vc '^packages/dashboard-next/'`
  outputs 0 (no changed path outside the package); the diff contains no
  eslint suppression/inline-config comments added — covering ALL forms:
  `git diff HEAD~1..HEAD | grep -cE '^\+.*(eslint-disable|eslint-enable|eslint-env|/\* *global |/\* *exported )'`
  → 0 (added lines only, so context/removed lines cannot skew it).
- A4: residual rule-id table present in the report.
- A5 (orchestrator, after rebuild + restart): screen verification 18/18
  PASS.

## Out of scope
- Manual fixes for residual problems (follow-up decision).
- eslint config changes, rule changes, suppressions.
- Any file outside packages/dashboard-next/.
