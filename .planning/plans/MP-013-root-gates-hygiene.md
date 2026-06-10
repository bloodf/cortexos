# MP-013 — root gates: ignore wrangler caches, then surface real residuals

## Requirements
- MP13-R1: root `pnpm lint` and `pnpm run format:check` FAIL on traversal
  of `stacks/honcho/mcp/.wrangler/tmp/*` (permission errors) — evidence:
  `.planning/harness/artifacts/recon-monorepo-audit.md:214-217`
  (§"Blockers"). `.wrangler` is a Cloudflare wrangler tool cache; durable
  command evidence at
  `.planning/harness/artifacts/recon-wrangler-evidence.md` (embedded in
  this gate run): :3-4 — `git ls-files stacks/honcho/mcp/.wrangler | wc -l`
  → 0 (untracked); :6-9 — `grep -c wrangler` on `.gitignore`,
  `.prettierignore`, `eslint.config.js` → 0, 0, 0 (absent from all three
  configs); :11-13 — the directory exists (`state`, `tmp`). Tool caches
  must be ignored, not linted.
- MP13-R2: after the ignores land, the root gates' REAL findings (if any)
  must be surfaced, not fixed blind: re-run both gates; if either still
  fails, quote the failure summary plus problem counts aggregated per
  top-level directory. If total problems exceed 100, that aggregated
  table is the full deliverable (scope decision belongs to the
  orchestrator); at or below 100, additionally list every finding
  verbatim. In no case fix anything — this plan only unblocks the gates.

ALL commands run from `/opt/cortexos`.

## File ownership (exclusive — exactly these three COMMITTED files, plus
## the report file which is written but never committed)
- `.gitignore` (add the wrangler cache pattern)
- `.prettierignore` (same)
- `eslint.config.js` (add to the global `ignores` array)
- Report (written, never committed — artifacts/ is gitignored):
  `/opt/cortexos/.planning/harness/artifacts/impl-mp-013-report.md`

## Tasks (append to the report after every step)
1. RED (quote each): `grep -c wrangler .gitignore` → 0;
   `grep -c wrangler .prettierignore` → 0;
   `grep -c wrangler eslint.config.js` → 0;
   `pnpm lint 2>&1 | tail -3` and `pnpm run format:check 2>&1 | tail -3`
   both showing the wrangler-permission failures.
2. Add `**/.wrangler/**` to `.prettierignore` and to the eslint config's
   global ignores (match each file's existing pattern style, e.g. like
   its `**/node_modules/**` entries); add `.wrangler/` to `.gitignore`
   under its existing "Runtime / Generated / Non-essential" heading.
3. GREEN: the three greps → 1 each. Re-run both root gates:
   - If both exit 0: quote the clean summaries.
   - Else: per MP13-R2 quote summaries + per-top-level-directory counts;
     >100 problems → that table completes the deliverable (IMPL-COMPLETE
     with the residual inventory — unblocking the gates IS this plan's
     goal); ≤100 → additionally list each finding verbatim.
4. ONE commit of exactly the three files:
   chore: ignore wrangler caches in lint/format/git — unblock root gates (MP-013)
   Do NOT stage .planning/**. NEVER push.
5. Acceptance summary + SHA; end IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: RED and GREEN grep counts as stated; both root-gate outputs quoted
  post-change with NO wrangler/permission errors present in either.
- A2: `git diff --name-only HEAD~1..HEAD` lists exactly the three files.
- A3: the residual inventory (or clean summaries) present per MP13-R2.

## Out of scope
- Fixing any real lint/format findings the unblocked gates reveal
  (separate decision from the inventory).
- Touching stacks/honcho contents or wrangler itself.

## Amendment (post-gate, evidence-driven — MP-003 precedent, logged in GATE-RESOLUTION)
The unblocked lint gate reported 154,365 problems under `packages` —
orchestrator probe 2026-06-10: a SINGLE minified bundle file
(`packages/dashboard-next/.output/public/assets/AreaTrend-QC4MnTGS.js`)
yields 21,722 auto-fixable errors, and the root IGNORE list
(eslint.config.js:45-57) covers dist/build/.svelte-kit/.next but NOT
Nitro's `**/.output/**`. The packages count is build artifacts, not code.
Amended Task 2b: also add `**/.output/**` to the eslint IGNORE array and
to `.prettierignore`; then re-run both root gates and re-produce the
MP13-R2 inventory (same rules). The orchestrator separately removed the
root-owned `stacks/honcho/mcp/.wrangler/tmp` (regenerable cache litter)
clearing the prettier traversal blocker. Amended acceptance: A1 applies
to the re-run; A2 covers the same three files (second commit:
`chore: ignore Nitro .output in root lint/format — real inventory (MP-013b)`).
