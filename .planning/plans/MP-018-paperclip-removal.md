# MP-018 — remove everything paperclip-related (operator directive)

## Requirements
- MP18-R1: operator directive 2026-06-10 (recorded in GATE-RESOLUTION):
  "We dont have paperclip anymore, we can remove everything related to
  paperclip in the project." Footprint (orchestrator recon 2026-06-10,
  durable evidence appended by Task 1):
  - `packages/paperclip-adapter/` — 14 tracked files
    (`git ls-files packages/paperclip-adapter | wc -l` → 14).
  - `.github/workflows/release-paperclip-adapter.yml` — its release
    workflow.
  - `eslint.config.js:27` (comment), `:270` (comment), `:278` (glob
    `packages/paperclip-adapter/**/*.{js,ts}` in the strict-libs block).
  - `packages/dashboard-next/src/server/incus/bridge.ts:665-680` — a
    SEED/STUB Incus container entry named `paperclip-relay` (name, slug,
    target fields); `.../__tests__/bridge.test.ts:512` — a test fixture
    hashing the action `incus.stop` against `{ name: "paperclip-relay" }`.
    These are data references, NOT imports of @cortexos/paperclip-adapter
    — zero code importers exist.
  - Host: no incus container, no systemd units (verified:
    `incus list --all-projects | grep -ci paperclip` → 0; no matching
    units in /etc/systemd/system).
  - Historical docs/research mentions stay (out-of-scope precedent,
    MP-007).
- MP18-R2: removing the workspace package changes `pnpm-lock.yaml` (run
  `pnpm install`, commit the lockfile in the same commit; peer-resolution
  cascade is expected and acceptable per the MP-007 precedent).
- MP18-R3: the dashboard's stub entry and test fixture must be removed/
  retargeted WITHOUT weakening the test: the bridge.test.ts fixture keeps
  asserting hash behavior using another existing seed container's name.

ALL commands run from `/opt/cortexos`.

## File ownership (committed; plus the report, never committed)
- DELETE: `packages/paperclip-adapter/` (whole tree),
  `.github/workflows/release-paperclip-adapter.yml`.
- EDIT: `eslint.config.js` (the three paperclip references),
  `pnpm-lock.yaml` (via pnpm install),
  `packages/dashboard-next/src/server/incus/bridge.ts` (remove the
  paperclip-relay stub entry),
  `packages/dashboard-next/src/server/incus/__tests__/bridge.test.ts`
  (retarget the fixture per MP18-R3).
- Report: `/opt/cortexos/.planning/harness/artifacts/impl-mp-018-report.md`

## Tasks (append to the report after EVERY step)
1. EVIDENCE (quote all): `git ls-files packages/paperclip-adapter | wc -l`
   → 14; `grep -rn paperclip .github/ | head -5`;
   `grep -n paperclip eslint.config.js`;
   `grep -n 'paperclip' packages/dashboard-next/src/server/incus/bridge.ts packages/dashboard-next/src/server/incus/__tests__/bridge.test.ts`;
   `grep -rn paperclip .github/dependabot.yml package.json pnpm-workspace.yaml` (expect: only the workflow file in .github, nothing in the others — quote whatever appears and handle any extra functional reference the same way).
2. Edit eslint.config.js (drop the glob from the strict-libs files array;
   fix both comments); edit bridge.ts (remove the stub entry); edit
   bridge.test.ts (retarget per MP18-R3).
3. `git rm -r -q packages/paperclip-adapter && git rm -q .github/workflows/release-paperclip-adapter.yml`.
4. `pnpm install` — quote the lockfile diff stat.
5. Gates (quote with exit codes):
   - `node --check eslint.config.js` → 0
   - `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit` → 0
   - `bash -c 'set -a; source /opt/cortexos/.secrets/dashboard.env; set +a; cd packages/dashboard-next && pnpm exec vitest run'`
     → zero failures (count may shift slightly with the fixture change;
     quote the totals)
   - `pnpm --filter @cortexos/dashboard-next build` → 0
   - `pnpm lint 2>&1 | tail -1` (totals drop by ~15 — paperclip's
     findings leave with it; quote)
   - `pnpm run format:check 2>&1 | tail -1` → exit 0
   - Tree-wide: `grep -rln paperclip . --include='*.ts' --include='*.js' --include='*.json' --include='*.yml' 2>/dev/null | grep -v node_modules | grep -v '.planning' | grep -v docs/`
     → empty (only historical docs remain).
6. ONE commit:
   chore!: remove paperclip-adapter and all functional references (MP-018)
   Do NOT stage .planning/**. NEVER push.
7. Acceptance summary + SHA; end IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: Task-1 evidence and every Task-5 gate quoted as stated; the
  tree-wide grep returns only docs/ paths or nothing.
- A2: `git show --stat HEAD` — deletions confined to the two DELETE
  targets; modifications confined to the four EDIT files.
- A3 (orchestrator, after rebuild + restart): screens 18/18.

## Out of scope
- Historical docs/research mentions (MP-007 precedent).
- Host-side actions (none exist — verified).
- MP-017 Wave A runs separately for contracts only (plan amended).
