# MP-016 — fix the import-x/extensions rule's internal inconsistencies (783 findings, config-correctness)

## Requirements
- MP16-R1: 783 `import-x/extensions` findings (top rule in
  `.planning/harness/artifacts/recon-residue-breakdown.md` top-20 table,
  row 1); breakdown evidence (orchestrator 2026-06-10, from the full run
  saved at /tmp during triage and quoted here): 777× `Missing file
  extension for "…"` + 1× `Missing file extension "tsx"` (778 in
  dashboard-next) and 2× `Unexpected use of file extension "js"`
  (cortex-audit).
- MP16-R2 (root cause A — missing map entry): `eslint.config.js:118-122`
  already declares the intent — comment `import-x/extensions: Vite/TS
  handle extensions; linting them is noise` — and configures
  `['error', 'ignorePackages', { js: 'never', mjs: 'never', ts: 'never' }]`
  but the exceptions map LACKS `tsx`, so under `ignorePackages` every
  relative import of a `.tsx` module demands an extension. The workspace
  is bundler-resolved (`tsconfig.base.json:6` —
  `"moduleResolution": "bundler"`;
  `packages/dashboard-next/tsconfig.json:17` — `"Bundler"`), so
  extensionless TS/TSX imports are the workspace's own documented
  convention. Fix: add `tsx: 'never'` (and `cts`/`mts` for completeness
  ONLY if findings exist for them — check, else leave) to the existing
  map. This completes the rule's stated intent; it is a config
  CORRECTNESS fix, not a relaxation.
- MP16-R3 (root cause B — JS runtime packages): the 2 `Unexpected use of
  file extension "js"` findings are in `packages/cortex-audit` — a plain
  .js Node-ESM package (`src/index.js`, `bin/cortex-audit.js`) where
  Node REQUIRES extensions on relative ESM imports; `js: 'never'` fights
  the runtime. Fix: a scoped override block for plain-JS Node packages
  (`packages/cortex-audit/**`, `packages/cortex-telemetry/**`,
  `packages/cortex-terminal/**` — the workspace's .js-source packages
  per the monorepo audit) setting
  `'import-x/extensions': ['error', 'ignorePackages', { js: 'always', mjs: 'always' }]`.
  Code must NOT be changed to satisfy the wrong rule direction.
- MP16-R4: while touching `.prettierignore`-adjacent config is NOT in
  scope, the MP-015 review's accepted MINOR (duplicate `templates/**`
  line in `.prettierignore`) IS folded in here as a one-line dedupe.

ALL commands run from `/opt/cortexos`.

## File ownership (committed; plus the report, never committed)
- `eslint.config.js` (the two rule changes per MP16-R2/R3)
- `.prettierignore` (remove the duplicate `templates/**` line, MP16-R4)
- Report: `/opt/cortexos/.planning/harness/artifacts/impl-mp-016-report.md`

## Tasks (append to the report after EVERY step)
1. RED (quote): `pnpm exec eslint . 2>&1 | grep -c 'import-x/extensions'`
   → ~783; `grep -c 'tsx' eslint.config.js` within the extensions map → 0
   (quote the current map lines); `grep -c 'templates/\*\*' .prettierignore`
   → 2.
2. Apply MP16-R2 (add `tsx: 'never'` to the existing map), MP16-R3 (the
   scoped JS-packages override), MP16-R4 (dedupe line).
3. GREEN (quote): `pnpm exec eslint . 2>&1 | grep -c 'import-x/extensions'`
   → 0; full `pnpm lint 2>&1 | tail -2` (expected total ≈ 1,908 − 783 =
   ~1,125); `grep -c 'templates/\*\*' .prettierignore` → 1;
   `pnpm run format:check 2>&1 | tail -1` still exit 0.
4. Gates (quote): dashboard-next tsc exit 0 + full suite (env sourced,
   no override) zero failures ≥ 558; `pnpm --filter @cortexos/audit test`
   green (its package was touched by the rule scope);
   `node --check packages/cortex-terminal/src/server.js` exit 0.
5. ONE commit of exactly the two owned files:
   chore: complete import-x/extensions rule intent — tsx exception + Node-ESM js packages (MP-016)
   Do NOT stage .planning/**. NEVER push.
6. Acceptance summary + SHA; end IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: RED/GREEN counts as stated; extensions findings → 0; total drops by
  the extensions count (±5).
- A2: `git diff --name-only HEAD~1..HEAD` = exactly the two files; no
  inline suppressions
  (`git diff HEAD~1..HEAD | grep -cE '^\+.*(eslint-disable|prettier-ignore)'` → 0).
- A3: Task-4 gates green.
- A4: zero source files changed (the fix is config-correctness; code
  churn would indicate the wrong direction was taken).

## Out of scope
- Any source-code edit (if the implementer believes one is needed, STOP
  and report — that contradicts the root-cause analysis).
- Changing the rule for TS packages beyond adding the missing `tsx`
  entry; touching package-level eslint configs.
