# MP-007 — remove the legacy SvelteKit dashboard (WP-54 phases 2-3)

## Requirements
- MP7-R1: operator approval recorded verbatim in
  `.planning/GATE-RESOLUTION.md` ("2026-06-10 — operator approvals"
  section: "Yes — login works, remove legacy"), satisfying the gate at
  `docs/rebuild/HANDOFF.md:27-31`. Scope per
  `docs/rebuild/STATUS.md:412` ("legacy removal (phases 2-3: rm
  packages/dashboard + stacks/cortex-dashboard) still pending user
  confirmation"): remove `packages/dashboard` (legacy
  SvelteKit, 783 tracked files / 32 MB) and `stacks/cortex-dashboard`
  (orphaned compose pointing at non-existent `packages/cortex-dashboard`,
  plus `.bak-20260529T181428` and `.retired` files).
- MP7-R2: break-risk inventory at
  `.planning/harness/artifacts/recon-legacy-refs.md` (RECON-COMPLETE).
  Every functional reference must be removed in the SAME commit:
  - `package.json:13` — `test:lint-rules` script runs
    `packages/dashboard/eslint-rules/verify-local-rules.mjs` (recon :10-12).
  - `eslint.config.js` — `:47` imports
    `./packages/dashboard/eslint-rules/index.cjs`; the `localPlugin`
    wrapper (~:68-73); ignores `:63-65`; blocks 7b/7c/7d
    (~:310-358) whose `files` globs all match only `packages/dashboard/**`
    (orchestrator-verified: the `local/*` rules are referenced nowhere
    outside those blocks — `grep -n 'local/' eslint.config.js` →
    :332,:348,:357 only).
  - `.github/dependabot.yml:11,27` — two `directory: /packages/dashboard`
    blocks (recon :27-28).
  - `.github/workflows/release.yml:31` — `path: packages/dashboard`
    (recon :29; remove the step/entry coherently after reading its context).
  - `templates/systemd/cortex-dashboard.service:41` — drop
    `{CORTEX_ROOT}/packages/dashboard` from `ReadWritePaths` (recon :99-100).
- MP7-R3: living docs updated in the same commit: `docs/rebuild/HANDOFF.md`
  (item 2 + the "rollback" section: legacy removed, rollback no longer
  available) and `docs/rebuild/STATUS.md` (WP-54 → done). Historical docs,
  audits, and `prompts/tools/*` references stay untouched (historical
  record — out of scope).
- MP7-R4: deleting a workspace package changes the lockfile: run
  `pnpm install` after the removal and commit the resulting
  `pnpm-lock.yaml` change in the same commit.

ALL commands run from `/opt/cortexos`; paths repo-relative.

## File ownership (exclusive)
- DELETE: `packages/dashboard/` (whole tree), `stacks/cortex-dashboard/`
  (whole tree).
- EDIT: `package.json`, `eslint.config.js`, `.github/dependabot.yml`,
  `.github/workflows/release.yml`, `templates/systemd/cortex-dashboard.service`,
  `docs/rebuild/HANDOFF.md`, `docs/rebuild/STATUS.md`, `pnpm-lock.yaml`.
- Report (never committed):
  `/opt/cortexos/.planning/harness/artifacts/impl-mp-007-report.md`
- NOT in scope: any host/systemd action (orchestrator does those), any
  other file.

## Tasks (ordered; deletion last so RED checks run against intact tree)
1. RED: record current state — `git ls-files packages/dashboard | wc -l`
   (expect ~783), `pnpm run test:lint-rules` exit 0 (still works today),
   `grep -c 'packages/dashboard/' eslint.config.js` (expect >0). Quote all.
2. Edit the five functional files per MP7-R2 (remove script, eslint import +
   localPlugin + blocks 7b/7c/7d + ignores, dependabot blocks, release.yml
   entry, ReadWritePaths path). Update the two living docs per MP7-R3.
3. `git rm -r -q packages/dashboard stacks/cortex-dashboard`.
4. `pnpm install` (lockfile updates; no other package changes expected —
   quote the lockfile diff stat).
5. Verify:
   - `node --check eslint.config.js` exit 0, and
     `pnpm exec eslint packages/dashboard-next/scripts/verify-screens.mjs`
     runs without config-load errors (rule findings are fine; a config
     crash is not).
   - For EACH of `eslint.config.js`, `package.json`,
     `.github/dependabot.yml`, `.github/workflows/release.yml`,
     `templates/systemd/cortex-dashboard.service`:
     `grep -nE 'packages/dashboard($|[^-])' <file>` returns no matches
     (pattern catches both `packages/dashboard/` and bare
     `packages/dashboard` at end-of-value, while `packages/dashboard-next`
     stays exempt).
   - `set -a; source /opt/cortexos/.secrets/dashboard.env; set +a; export NODE_ENV=test; pnpm --filter @cortexos/dashboard-next exec tsc --noEmit` exit 0.
   - `pnpm --filter @cortexos/dashboard-next exec vitest run src/server src/lib/api` exit 0.
6. ONE commit:
   `chore!: remove legacy SvelteKit dashboard + orphaned stack (WP-54 phases 2-3, MP-007)`

## Acceptance (binary)
- A1: Task-1 RED outputs and every Task-5 check quoted with stated results.
- A2: `git show --stat HEAD` shows deletions confined to
  `packages/dashboard/*` and `stacks/cortex-dashboard/*`; modifications
  confined to the eight EDIT-listed files.
- A3 (orchestrator, after central rebuild + restart): screen verification
  run shows 18/18 PASS (live app unaffected).
- A4 (living docs, binary): `grep -nE 'WP-54.*\| *done *\|' docs/rebuild/STATUS.md`
  returns ≥1 match (WP-54 row no longer "wip"); `grep -ncE 'pending user
  confirmation' docs/rebuild/STATUS.md` relevant to WP-54 drops to 0 on
  lines containing WP-54; and `grep -ciE 'legacy .*(removed|deleted)' docs/rebuild/HANDOFF.md`
  returns ≥1 (HANDOFF states the removal and that SvelteKit rollback is no
  longer available).
- A5 (lockfile, binary): the report quotes `pnpm install` exit 0 and the
  `git diff --stat -- pnpm-lock.yaml` output; `git show HEAD --stat` lists
  `pnpm-lock.yaml` among the modified files.

## Out of scope
- Host/systemd changes (orchestrator-owned, after this lands).
- `cortex-dashboard-root-helper.service/.socket` (flagged to operator —
  needs its own investigation; do not touch).
- Historical docs / prompts/tools references (recon :32-56 "informational").
- Any dashboard-next source change.
