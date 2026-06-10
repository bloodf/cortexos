# MP-017 — manual lint waves: per-package fixes for the final ~1,142 first-party findings

## Requirements
- MP17-R1: post-MP-016 residue (orchestrator capture 2026-06-10, durable
  artifact `.planning/harness/artifacts/recon-residue2-breakdown.md`,
  created by the orchestrator from the verified post-MP-016 full-repo
  eslint run — extensions findings independently confirmed 0 in the same
  run): per-package —
  dashboard-next 850, cortex-mail-guardian 94, contracts 62, cortex-audit
  58, cortex-telemetry 41, cortex-terminal 21, paperclip-adapter 15. (The
  capture also showed +1 finding rendered as `1 fig.mjs` in the
  artifact's per-package table — an awk-substring truncation of the
  non-packages path `/opt/cortexos/test2.config.mjs`; the orchestrator
  identified the real path from the raw run, found it to be an UNTRACKED
  scratch file left by the MP-016 worker's resolver experiment, and
  deleted it 2026-06-10. Not part of this campaign.) Per-rule top: no-use-before-define 177,
  import-x/prefer-default-export 135, no-restricted-syntax 127,
  only-throw-error 75, no-continue 60, no-await-in-loop 51, no-void 49,
  no-nested-ternary 48, no-unused-vars 44, no-underscore-dangle 36,
  no-plusplus 30, n/no-process-env 27, explicit-module-boundary-types 27,
  no-console 26, naming-convention 25, remainder smaller.
- MP17-R2: behavior must not change. Standing guards per wave: the owning
  package's full gates (tests/build per the monorepo audit) + the
  dashboard deploy verification at the end of the campaign.
- MP17-R3 (operator directive, GATE-RESOLUTION "wave strategy"): the
  campaign code-fixes first-party findings with NO suppressions and NO
  rule changes. Bounded exception mechanism: occurrences where the
  mechanical fix would degrade the code (the explicitly enumerated cases
  in the strategies below — e.g. intentional sequential awaits, CLI
  console output, public-API names) are ESCALATED, not fixed and not
  suppressed: each is listed with file:line + reason in the wave report
  and ADJUDICATED by the orchestrator (fix-anyway / accept-as-logged)
  before that wave's work is pushed. "Accepted" escalations remain
  visible lint findings by design — never silenced.

## File ownership (per wave, exclusive)
- A wave may edit ONLY: (a) files under its named package directory(ies);
  (b) for export-shape conversions, the direct importers of a converted
  export — IN ANY package — discovered via `grep -rn '<name>' packages/`
  and tagged `[importer:<name>]` in the report before editing (MP-011
  mechanism; this clause is the SOLE cross-package exception); (c) its
  report file (never committed). Nothing else — no eslint/prettier/ts
  configs, no .planning/**, no packages beyond (a)+(b).

## Per-rule strategies (binding; the MP-011 mechanism — committed plan at
## `.planning/plans/MP-011-lint-residuals.md`: per-rule strategies,
## STOP/escalate conditions, provenance tags)
- `no-use-before-define` (177): reorder declarations (hoist helpers above
  first use) — pure moves, no logic edits. If a circular reference makes
  reordering impossible, escalate that occurrence.
- `import-x/prefer-default-export` (135): single-export modules get a
  default export ONLY when no importer churn results (update importers in
  the same wave, tag provenance); where a module is conventionally
  named-export (e.g. barrel files, contracts entities), CONVERT IS WRONG —
  escalate with a one-line rationale instead (these become an accepted
  list in the wave report).
- `no-restricted-syntax` (127, mostly for...of) / `no-continue` (60) /
  `no-plusplus` (30): rewrite to array methods / guard clauses / `+= 1`
  where the result stays readable; if a rewrite would obscure a hot loop
  or stream-processing pattern, escalate the occurrence.
- `only-throw-error` (75): wrap thrown non-Errors in `new Error(...)` (or
  the package's typed error helper where one exists) — correctness-class,
  fix all.
- `no-await-in-loop` (51): convert to `Promise.all` ONLY where iterations
  are independent (read the loop body); sequential-by-design loops get
  escalated (ops sequencing is intentional).
- `no-void` (49): replace `void expr` fire-and-forget with the package's
  existing pattern (`.catch(() => {})` or explicit ignore helper).
- `no-nested-ternary` (48): extract to if/else or helper.
- `no-unused-vars` (44): delete dead bindings; underscore-prefix
  intentional discards (config already allows `^_`).
- `no-underscore-dangle` (36): rename to the allowed `^_` discard pattern
  or non-dangling names; public API fields NEVER renamed — escalate.
- `n/no-process-env` (27): centralize reads through the package's
  config/env module where one exists; else escalate (env reads in config
  loaders are idiomatic).
- `explicit-module-boundary-types` (27): add return types.
- `no-console` (26): in libraries route through the package's
  logger/telemetry pattern; CLI entrypoints (bin/) escalate (console IS
  the interface).
- `naming-convention` (25) + remainder: mechanical per the rule message;
  anything ambiguous escalates.
- ESCALATION = list the occurrence (file:line, rule, one-line reason) in
  the wave report; gates still must pass; escalated occurrences form the
  wave's accepted-list, adjudicated by the orchestrator before push.

## Execution slicing (sequential micro-jobs, one commit per wave)
- Wave A: contracts (62) + paperclip-adapter (15).
  Commit: `fix(lint): manual wave A — contracts, paperclip-adapter (MP-017)`
- Wave B: cortex-audit (58) + cortex-telemetry (41) + cortex-terminal
  (21). Commit: `fix(lint): manual wave B — audit, telemetry, terminal (MP-017)`
- Wave C: cortex-mail-guardian (94). Commit: `fix(lint): manual wave C — mail-guardian (MP-017)`
- Waves D1-D3: dashboard-next (850) split by rule groups — D1 ordering
  (no-use-before-define) + unused-vars; D2 syntax rewrites
  (restricted-syntax/continue/plusplus/nested-ternary/void); D3 the rest
  (exports, throws, types, naming, console, env, underscores). Commits:
  `fix(lint): manual wave D1|D2|D3 — dashboard-next <group> (MP-017)`
- Every wave job: incremental report writes; per-file eslint re-check;
  the owning package's gates before its commit; escalations listed.
  Dashboard-next waves additionally run tsc + full suite (≥558) before
  committing.

## Tasks per wave (template)
1. Capture the wave's findings listing (file:line:rule) — quote.
2. Fix file-by-file per the strategies; escalate per the rules above.
3. Package gates (audit table commands) — quote green.
4. Commit (exact message). Do NOT stage .planning/**. NEVER push.
5. Report: fixed count, escalated list, remaining repo lint total.

## Acceptance (binary, per wave)
- A1: the wave's TARGETED findings = 0 except the escalated list — for
  single-package waves (A, B, C) that means the package's full lint
  findings; for the split dashboard-next waves, D1 and D2 zero their
  assigned RULE GROUPS within the package, and only D3 (the final wave)
  zeroes the package's full findings (minus adjudicated escalations).
- A2: package gates green for the wave's package(s) AND for every package
  whose importer files were edited under the cross-package clause (run
  that package's audit-table gates too); for dashboard-next waves: tsc 0
  + ≥558 zero failures.
- A3: no suppression comments added —
  `git diff HEAD~1..HEAD | grep -cE '^\+.*(eslint-disable|eslint-enable|eslint-env|prettier-ignore|/\* *global )'`
  → 0; no eslint/prettier config changes
  (`git diff HEAD~1..HEAD --name-only | grep -cE 'eslint|prettier'` → 0).
- A4 (campaign end, orchestrator): repo lint total = sum of adjudicated
  escalations only; dashboard rebuild + restart + screens 18/18; push.

## Out of scope
- Rule/config changes, suppressions, dependency changes.
- Behavior changes of any kind; public API renames.
