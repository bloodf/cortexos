# Work breakdown — dashboard verification fixes (fix/dashboard-deslop)

Objective: every authed dashboard-next route renders clean — no error
boundary, no console errors, no failed server-fn calls — verified by the
Playwright screen harness.

Requirements (traced to `docs/rebuild/HANDOFF.md`):
- R1 (HANDOFF.md:19-26): re-run `scripts/verify-screens.mjs`, capture URL +
  body of every non-2xx server-fn response, fix the mis-shaped inputs, repeat
  until every authed route renders clean.
- R2 (HANDOFF.md:27-31): legacy `packages/dashboard` removal is USER-GATED —
  out of scope here.
- R3 (HANDOFF.md:32-35): decide the uncommitted tree — playwright devDep in
  `package.json`/`pnpm-lock.yaml`, untracked `scripts/verify-screens.mjs`.

Repo: `/opt/cortexos`. Branch: `fix/dashboard-deslop`. Diff-gate base: the
HEAD recorded in each micro-plan at dispatch. HEAD at breakdown time
(reproduce with `git log --oneline -2`):

    570df0e chore(harness): CLI multi-agent worker harness under .planning/harness
    6614ea9 docs(rebuild): add resume HANDOFF (loop-integrated) + fix list

HANDOFF.md names `af82182` as last commit because it was written before its
own commit `6614ea9` landed; dashboard source is unchanged since `af82182`.

Quality gates (run from repo root, `dashboard.env` sourced):
- G1 types: `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit`
- G2 tests: `pnpm --filter @cortexos/dashboard-next exec vitest run src/server src/lib/api`
- G3 lint: `pnpm exec eslint packages/dashboard-next`
- G4 build (central only, never parallel): `pnpm --filter @cortexos/dashboard-next build`
- G5 screens: `node packages/dashboard-next/scripts/verify-screens.mjs` →
  zero failures across all three classes per authed route: (a) non-2xx
  server-fn responses, (b) browser console errors, (c) error-boundary
  renders. If the script does not yet count classes (b)/(c), WP-B0 extends it.

## WP-A — commit the verification harness (needs your OK: adds playwright as devDependency)
Evidence: HANDOFF.md "Uncommitted working tree" — `package.json`/`pnpm-lock.yaml`
already modified by the paused verify agent; `scripts/verify-screens.mjs` untracked.
Tasks: commit the three files as one change. No code edits.
Acceptance (binary): one commit exists whose `git show --stat` lists exactly
those three paths; `git status --porcelain` is clean for them; G1 passes.
Owner: orchestrator (trivial op, no worker).

## WP-B0 — extend verify-screens.mjs to count classes b/c (conditional)
Runs only if inspection shows the script does not already fail on console
errors or error-boundary renders. Gets its own micro-plan through the
gpt-5.5 gate, TDD-ordered: first a fixture route (or seeded fault) that
makes the script exit non-zero for each uncounted class, then the
implementation.
Acceptance (binary): script exits non-zero against the seeded fault for
classes b and c, exits zero against a known-clean route; fixture removed
after; only `scripts/verify-screens.mjs` and its fixture touched.

## WP-B — defect inventory from screen verification
Tasks: m27-hs recon job re-runs `verify-screens.mjs` with a minted admin
session (recipe in HANDOFF.md "Headless auth recipe"; session row DELETEd
after) and writes `artifacts/screen-defects.md`: one entry per failure with
a sequential defect ID `D-001..D-NNN`, failure class (a/b/c per G5), route
URL, server-fn name where applicable, HTTP status, full response body or
console/error-boundary message.
Acceptance (binary): report exists, ends `RECON-COMPLETE`, and lists either
zero defects or N defects where every entry carries ID + class + route URL,
plus for class (a) the server-fn name, HTTP status, and full response body,
and for classes (b)/(c) the full console/error-boundary message. An entry
missing any of these fields fails the gate. Zero defects ⇒ WP-C/D skipped.
Out of scope: any file modification outside the report (script changes
belong to WP-B0).

## WP-C — per-defect micro-plans (one per defect cluster, all classes)
For each defect cluster in WP-B's report, regardless of class: I write a
micro-plan (requirement IDs traced to `screen-defects.md` lines plus the
implicated source line — e.g. the `src/lib/api/*.functions.ts` zod schema
for class (a), the component for classes (b)/(c); exclusive file ownership;
TDD-ordered). Binary acceptance: a failing test reproducing the defect where
unit-testable (class a always), otherwise the G5 class check for that route
flipping from fail to pass. Each micro-plan passes the gpt-5.5 gate before
dispatch.
Acceptance (binary): every `D-NNN` from `screen-defects.md` appears in
exactly one gated micro-plan; no micro-plan cites a defect ID absent from
the report.

## WP-D — implement fixes (m3), verify, gate, push
Per micro-plan: m3 implements (failing test first, commit per task, no push)
→ m27-hs runs G1+G2+G3 → kimi diff gate vs the micro-plan → I push.
Parallel m3 workers only when plans own disjoint files; `client.ts` is
single-owner at all times (HANDOFF.md: concurrent edits drop exports).
Acceptance (binary): G1-G4 pass; G5 passes in full — zero failures across
all three classes (non-2xx server-fn, console errors, error-boundary
renders) on every authed route; kimi diff verdict PASS; branch pushed.

## WP-E — service redeploy check
After WP-D: central rebuild (G4), boot test on scratch port, `sudo systemctl
restart cortex-dashboard.service`, `/login` returns 200.
Acceptance (binary): curl `/login` → 200; `systemctl is-active cortex-dashboard` → active.

## Out of scope (entire breakdown)
- Legacy `packages/dashboard` removal — USER-GATED per HANDOFF.md item 2;
  requires operator-confirmed browser PAM login first.
- `hermes-webui/`, `9router-fork-archive-20-fork.conf.txt` — unrelated host
  artifacts, stay untracked.
- Schema changes; new dependencies beyond WP-A; deleting tracked repo files.
  (Cleanup of ephemeral artifacts is allowed and required: the minted
  `admin_sessions` DB row in WP-B and the test fixture in WP-B0.)
