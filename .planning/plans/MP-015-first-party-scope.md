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
  coverage ERRORS, not code findings — verbatim sample at
  `.planning/harness/artifacts/recon-parser-coverage-sample.md:3-7`:
  `0:0 error Parsing error: /opt/cortexos/packages/contracts/test/approval.test.ts
  was not found by the project service. Consider either including it in
  the tsconfig.json or including it in allowDefaultProject` (affected
  paths sampled at :9-16: contracts test files, contracts
  vitest.config.ts, cortex-audit src/index.d.ts; count source:
  `.planning/harness/artifacts/recon-residue-breakdown.md` top-20 table
  row 13; of the 41, 19 sit under `stacks/**` per that report's
  per-area table). Treatment: FIRST-PARTY entries (under `packages/`)
  must be fixed by tsconfig/parserOptions coverage — never by inline
  suppression — and must reach zero; entries inside the MP15-R1
  non-first-party dirs leave lint scope entirely via Task 2 (they are
  not suppressed findings — the content is no longer graded at all,
  per the operator directive).
- MP15-R3: `.eslintrc.cjs` stays — its header documents deliberate
  forward-compat retention.

ALL commands run from `/opt/cortexos`.

## File ownership (committed; plus the report, never committed)
- `eslint.config.js` (IGNORE additions per Task 2)
- `.prettierignore` (same)
- For MP15-R2 ONLY, bounded to: `tsconfig.base.json` and EXISTING
  `packages/**/tsconfig*.json` files, and/or the parserOptions /
  projectService block inside `eslint.config.js`. No NEW tsconfig files;
  every touched file named + justified per-path in the report.
- Report: `/opt/cortexos/.planning/harness/artifacts/impl-mp-015-report.md`
- Evidence appends (never committed — artifacts/ is gitignored):
  `/opt/cortexos/.planning/harness/artifacts/recon-residue-breakdown.md`
  (Task 1 appends the MP-015 evidence section there)

## Tasks (append to the report after EVERY step)
1. EVIDENCE: run and quote `git ls-files hermes hermes-webui | wc -l`,
   `git ls-files stacks scripts templates` (full list), and append the
   same outputs to recon-residue-breakdown.md under an "MP-015 evidence"
   heading. Quote the current `pnpm lint 2>&1 | tail -2` baseline.
2. PRE-IGNORE CAPTURE (strictly before Task 3): capture the COMPLETE
   current `allowDefaultProject` path list —
   `pnpm exec eslint . 2>&1 | grep -B2 allowDefaultProject | grep '^/' | sort -u`
   — quote all paths (expected ~41 incl. ~19 under stacks/) and append
   them to the recon evidence file. This is the authoritative split
   input for Task 4 (the Task-3 ignores will hide the non-first-party
   ones from later runs, by design).
3. Add to BOTH the eslint IGNORE array and `.prettierignore`:
   `hermes/**`, `hermes-webui/**`, `stacks/**`, `scripts/**`,
   `templates/**` — with a one-line comment in each file: untracked
   vendored/host-local content, first-party scope per MP-015. (Tracked
   non-JS files there — env/shell/systemd — are not lintable by these
   tools, so nothing first-party loses coverage; state this in the
   report.)
4. Parser coverage: from the Task-2 list, for each FIRST-PARTY path
   (under packages/), extend the nearest existing tsconfig `include` (or
   the flat-config `parserOptions.projectService.allowDefaultProject`
   allowlist if the file is a standalone config like `vitest.config.ts`)
   so the error disappears. Per-path: name the file edited + why. Paths
   from the Task-2 list inside Task-3 ignored dirs: list them as
   out-of-scope-by-directive (no action).
5. Re-inventory (quote): `pnpm lint 2>&1 | tail -2` — expected: total ≈
   packages-only (~1,900);
   `pnpm exec eslint . 2>&1 | grep -c allowDefaultProject` → 0;
   `pnpm run format:check 2>&1 | tail -2` — exit 0. Per-top-level-dir
   counts via the binary pipeline:
   `pnpm exec eslint . 2>&1 | awk '/^\// {split(substr($1,length("/opt/cortexos/")+1),p,"/"); d=p[1]} /^[[:space:]]+[0-9]+:[0-9]+/ {c[d]++} END {for (k in c) print c[k], k}' | sort -rn`
   — quote the table; every key except `packages` must be absent or 0.
6. Gates: dashboard-next tsc + full suite (env sourced, no override,
   ≥558, zero failures) — config/tsconfig changes can affect it; quote.
7. ONE commit of the touched config files:
   chore: scope root lint/format to first-party tracked code; fix parser coverage (MP-015)
   Do NOT stage .planning/**. NEVER push.
8. Acceptance summary + SHA; end IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: Task-1 evidence quoted (tracked counts as stated in MP15-R1), AND
  the Task-2 COMPLETE pre-ignore `allowDefaultProject` path list is
  quoted in the report (count ≈ 41) with every path tagged first-party
  or ignored-dir — Task 4's split must reference exactly this list.
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
