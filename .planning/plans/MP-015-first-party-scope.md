# MP-015 — scope root lint/format to first-party code; fix parser coverage

## Requirements
- MP15-R1 (operator directive, recorded in GATE-RESOLUTION "wave
  strategy" entry): code-fix applies to OUR code only — the tracked
  cortexos tree. Orchestrator-verified 2026-06-10 (durable evidence to be
  appended to `.planning/harness/artifacts/recon-residue-breakdown.md` by
  the implementer's Task 1): `git ls-files <dir> | wc -l` → `hermes` 0,
  `hermes-webui` 0, `stacks` 1 (an `.env` file), `scripts` 2 (shell),
  `templates` 4 (systemd units) — i.e. every lint finding outside
  `packages/` (per-directory counts in
  `.planning/harness/artifacts/impl-mp-014-report.md`: stacks 102,
  hermes 175, scripts 156, templates 10) sits in UNTRACKED vendored or
  host-local content that git cannot even commit. Root eslint/prettier
  must stop grading it.
- MP15-R2: 41 `allowDefaultProject` entries in the residue are parser
  coverage errors (files not matched by any tsconfig project for
  type-aware parsing), not code findings
  (`.planning/harness/artifacts/recon-residue-breakdown.md`, top-20
  table, row 13). They must be fixed by tsconfig/parserOptions coverage —
  never by suppression.
- MP15-R3: `.eslintrc.cjs` stays — its header documents deliberate
  forward-compat retention.

ALL commands run from `/opt/cortexos`.

## File ownership (committed; plus the report, never committed)
- `eslint.config.js` (IGNORE additions per Task 2)
- `.prettierignore` (same)
- tsconfig files and/or `eslint.config.js` parserOptions blocks as needed
  for MP15-R2 (each touched file named + justified in the report)
- Report: `/opt/cortexos/.planning/harness/artifacts/impl-mp-015-report.md`

## Tasks (append to the report after EVERY step)
1. EVIDENCE: run and quote `git ls-files hermes hermes-webui | wc -l`,
   `git ls-files stacks scripts templates` (full list), and append the
   same outputs to recon-residue-breakdown.md under an "MP-015 evidence"
   heading. Quote the current `pnpm lint 2>&1 | tail -2` baseline.
2. Add to BOTH the eslint IGNORE array and `.prettierignore`:
   `hermes/**`, `hermes-webui/**`, `stacks/**`, `scripts/**`,
   `templates/**` — with a one-line comment in each file: untracked
   vendored/host-local content, first-party scope per MP-015. (Tracked
   non-JS files there — env/shell/systemd — are not lintable by these
   tools, so nothing first-party loses coverage; state this in the
   report.)
3. Parser coverage: list the 41 `allowDefaultProject` paths from a fresh
   `pnpm exec eslint . 2>&1 | grep -B2 allowDefaultProject`. For each
   path that is FIRST-PARTY (under packages/), extend the nearest
   tsconfig `include` (or the flat-config `parserOptions.projectService.
   allowDefaultProject` allowlist if the file is a standalone config like
   `vitest.config.ts`) so the error disappears. Paths that fall inside
   the Task-2 ignored dirs need nothing (state which).
4. Re-inventory (quote): `pnpm lint 2>&1 | tail -2` — expected: total ≈
   packages-only (~1,900) and ZERO `allowDefaultProject` entries;
   `pnpm run format:check 2>&1 | tail -2` — exit 0. Per-top-level-dir
   counts: every dir except `packages` → 0.
5. Gates: dashboard-next tsc + full suite (env sourced, no override,
   ≥558, zero failures) — config/tsconfig changes can affect it; quote.
6. ONE commit of the touched config files:
   chore: scope root lint/format to first-party tracked code; fix parser coverage (MP-015)
   Do NOT stage .planning/**. NEVER push.
7. Acceptance summary + SHA; end IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: Task-1 evidence quoted (tracked counts as stated in MP15-R1).
- A2: post-change inventory — `allowDefaultProject` count 0; non-packages
  per-dir lint counts all 0; format:check exit 0.
- A3: no suppression comments added
  (`git diff HEAD~1..HEAD | grep -cE '^\+.*(eslint-disable|prettier-ignore)'` → 0);
  the IGNORE additions are directory-scope entries only (visible in the
  quoted diff).
- A4: Task-5 gates green.

## Out of scope
- Any code fix (the packages/ waves follow).
- Deleting untracked content; `.eslintrc.cjs` (MP15-R3).
