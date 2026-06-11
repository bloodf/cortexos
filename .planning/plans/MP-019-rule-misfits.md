# MP-019 — config-correctness for three demonstrated rule misfits

## Requirements
- MP19-R1 (TS-only rule on plain JS): `@typescript-eslint/
  explicit-module-boundary-types` is enforced at `eslint.config.js:288`
  over globs that include plain-.js packages. Wave B evidence
  (`.planning/harness/artifacts/impl-mp-017b-report.md:130,133,135,139`
  — escalation-table rows): 14 occurrences in the two plain-JS packages — cortex-audit
  src/index.js ×7, src/jcs.js ×1, src/rekor.js ×1, cortex-telemetry
  src/index.js ×5 — each tagged "Plain-JS; unfixable without tsconfig/TS
  conversion" (the repo-wide grep also counts occurrences elsewhere;
  Task 1 measures the authoritative current baseline) — the rule
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
  — 114 findings, all in packages/dashboard-next: durable capture
  `.planning/harness/artifacts/recon-dn-residue-119.txt` (first finding
  at :3; `grep -c prefer-default-export` → 114, orchestrator-verified
  2026-06-11; re-measured as P in Task 1). Named exports are the
  DELIBERATE convention: TanStack Router file routes export a named
  `Route` const the router resolves by name — e.g.
  `src/routes/_authenticated.admin.users.tsx:4`:
  `export const Route = createFileRoute("/_authenticated/admin/users")({...})`
  — across 35 route files
  (`grep -rln 'export const Route = createFileRoute' src/routes/ | wc -l`
  → 35); the codebase's components/server-functions follow named-export
  style throughout (the released, verified product).
  Mass-converting 114 modules would churn hundreds of importers against
  framework requirements — the operator-accepted escalation mechanism
  (GATE-RESOLUTION "wave strategy") covers exactly this
  fix-would-degrade case as a CLASS. Fix (SCOPED to the evidence): a
  `packages/dashboard-next/**` override block disabling
  `import-x/prefer-default-export` with the rationale comment — the rule
  stays active everywhere else (other packages' instances were code-fixed
  in waves A-C).
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
1. RED — the BINDING baseline measurement (quote each; these measured
   values ARE the baseline, no approximations): run
   `pnpm exec eslint . 2>&1 > /tmp/mp019-red.txt` once, then quote
   `tail -1 /tmp/mp019-red.txt` (repo total T) and
   `grep -c '<rule>' /tmp/mp019-red.txt` for each of
   prefer-default-export (P), explicit-module-boundary-types (E),
   no-useless-path-segments (U).
2. Apply MP19-R1/R2/R3 — three edits, each carrying a one-line
   `// MP-019: <reason>` comment (the A2 marker).
3. GREEN (quote): prefer-default-export grep → 0 (all 114 are inside
   the scoped override's globs); the other two rule greps → 0 EXACTLY;
   `node --check eslint.config.js` → 0; new repo total = T − P − E − U
   exactly (quote the arithmetic with the Task-1 measured values).
4. Gates, exact commands (quote each with exit code):
   - `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit` → exit 0
   - `bash -c 'set -a; source /opt/cortexos/.secrets/dashboard.env; set +a; cd packages/dashboard-next && pnpm exec vitest run'`
     → zero failures, ≥ 558 tests;
   `pnpm --filter @cortexos/audit test` exit 0;
   `pnpm --filter @cortexos/mail-guardian test` exit 0;
   `pnpm run format:check 2>&1 | tail -1` exit 0.
5. ONE commit of exactly eslint.config.js:
   chore: scoped rule corrections — TS-only rule off JS, path-segments/extensions conflict, named-export convention (MP-019)
   Do NOT stage .planning/**. NEVER push.
6. Acceptance summary + SHA; end IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: the Task-1 measured baseline quoted; the three rules' findings →
  0 exactly; new total = T − P − E − U (arithmetic quoted).
- A2: `git diff --name-only HEAD~1..HEAD` = exactly eslint.config.js; no
  inline suppressions
  (`git diff HEAD~1..HEAD | grep -cE '^\+.*(eslint-disable|prettier-ignore)'` → 0);
  zero source files changed; rationale comments present —
  `git diff HEAD~1..HEAD | grep -cE '^\+.*// MP-019:'` → 3 (each of the
  three edits carries a `// MP-019: <reason>` comment line).
- A3: Task-4 gates green.

## Out of scope
- Any source edit; the MP19-R4 accepted findings; package-level configs.
