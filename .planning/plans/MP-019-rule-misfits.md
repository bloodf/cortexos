# MP-019 — config-correctness for three demonstrated rule misfits

## Requirements
- MP19-R1 (TS-only rule on plain JS): `@typescript-eslint/
  explicit-module-boundary-types` is enforced at `eslint.config.js:288`
  over globs that include plain-.js packages. Wave B evidence
  (`.planning/harness/artifacts/impl-mp-017b-report.md` escalation
  table): ~26 occurrences across cortex-audit/cortex-telemetry tagged
  "Plain-JS; unfixable without tsconfig/TS conversion" — the rule
  requires TS return-type syntax that .js files cannot express (JSDoc
  does not satisfy it under the current parser config). Fix: a scoped
  override disabling this rule for `**/*.{js,mjs,cjs}`.
- MP19-R2 (rule pair conflict): `import-x/no-useless-path-segments`
  flags `'../src/index.js'` → `'../src'`, while the MP-016 JS-packages
  override (eslint.config.js:324 block) requires `js: 'always'`
  extensions (Node-ESM runtime need; directory imports do not resolve in
  Node ESM). Wave B escalations document the conflict ("fixing triggers
  extension error"). Fix: in the JS-packages override block, configure
  `'import-x/no-useless-path-segments': ['error', { noUselessIndex: false }]`
  (or disable there if the option proves insufficient — implementer
  verifies with the live files; zero new findings is the criterion).
- MP19-R3 (framework-convention misfit): `import-x/prefer-default-export`
  — 114 remaining findings, ALL in packages/dashboard-next (current
  count quoted in the implementer's Task 1), where named exports are the
  DELIBERATE convention: TanStack Router file routes REQUIRE named
  `Route` exports; the codebase's components/server-functions follow
  named-export style throughout (the released, verified product).
  Mass-converting 114 modules would churn hundreds of importers against
  framework requirements — the operator-accepted escalation mechanism
  (GATE-RESOLUTION "wave strategy") covers exactly this
  fix-would-degrade case as a CLASS. Fix: disable
  `import-x/prefer-default-export` in the root config's main rules block
  with a comment recording the rationale (named-export convention;
  TanStack route requirement).
- MP19-R4: two PROVEN false positives stay as accepted findings (no
  config change, no suppression): `src/mocks/drift.ts:97`
  no-unnecessary-type-assertion (removing the assertion broke tsc —
  MP-014 revert evidence) and
  `src/server/db/__tests__/client.test.ts:18` prefer-arrow-callback
  (conversion broke constructor mocking — D3e revert evidence). They are
  documented here and in GATE-RESOLUTION; final lint total = these 2 +
  the adjudicated escalations in other packages.

ALL commands run from `/opt/cortexos`.

## File ownership (committed; plus the report, never committed)
- `eslint.config.js` ONLY.
- Report: `/opt/cortexos/.planning/harness/artifacts/impl-mp-019-report.md`

## Tasks (append to the report after EVERY step)
1. RED (quote): `pnpm exec eslint . 2>&1 | tail -1` (repo total);
   `pnpm exec eslint . 2>&1 | grep -c 'prefer-default-export'` (≈114);
   `pnpm exec eslint . 2>&1 | grep -c 'explicit-module-boundary-types'`
   (≈26); `pnpm exec eslint . 2>&1 | grep -c 'no-useless-path-segments'`.
2. Apply MP19-R1/R2/R3 (three edits, each with a one-line rationale
   comment).
3. GREEN (quote): the three rule greps → 0;
   `node --check eslint.config.js` → 0; new repo total (expected ≈ the
   adjudicated-escalation count + 2).
4. Gates (quote): dashboard-next tsc exit 0 + full suite zero failures
   (env sourced from /opt/cortexos/.secrets/dashboard.env);
   `pnpm --filter @cortexos/audit test` exit 0;
   `pnpm --filter @cortexos/mail-guardian test` exit 0;
   `pnpm run format:check 2>&1 | tail -1` exit 0.
5. ONE commit of exactly eslint.config.js:
   chore: scoped rule corrections — TS-only rule off JS, path-segments/extensions conflict, named-export convention (MP-019)
   Do NOT stage .planning/**. NEVER push.
6. Acceptance summary + SHA; end IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: RED/GREEN counts as stated; the three rules' findings → 0.
- A2: `git diff --name-only HEAD~1..HEAD` = exactly eslint.config.js; no
  inline suppressions
  (`git diff HEAD~1..HEAD | grep -cE '^\+.*(eslint-disable|prettier-ignore)'` → 0);
  zero source files changed.
- A3: Task-4 gates green.

## Out of scope
- Any source edit; the MP19-R4 accepted findings; package-level configs.
