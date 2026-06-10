# Gate resolutions — cycle-limit escalations

Per operating rule 4: documents that hit 3 reject cycles are escalated with
a disposition per remaining finding. Overrules require rationale here; no
finding is dismissed silently.

## 2026-06-10 — BREAKDOWN.md (3 cycles, escalated, user approved)
Artifacts: `harness/artifacts/critic-plan-BREAKDOWN.md-{1,2,3}.md`.
All 11 findings across 3 cycles: FIXED in the doc. No overrules.
User approved execution starting at WP-A.

## 2026-06-10 — MP-001 (3 cycles, escalated)
Artifacts: `harness/artifacts/critic-plan-MP-001-verify-screens-badresponses.md-{1,2,3}.md`.
Cycle 1-2 findings (path typo, capture-condition wording, missing evidence
context): FIXED. Cycle 3 dispositions:
- [MAJOR] 3xx-deviation lacked evidence → FIXED: justification now cites
  that all class (a) defects D-003..D-033 are HTTP 400, inside the >=400
  filter; no inference about redirects remains.
- [MAJOR] No binary criterion proving URL/body lines print → FIXED: added
  A5, checked against the post-MP-001 WP-B re-run log before any push.
- [MINOR] RED-check log not in critic evidence base → FIXED: plan records
  orchestrator-verified existence + result, and keeps the source-level
  fallback check.
No overrules.

## 2026-06-10 — AN-001 analysis (3 cycles, dispositions applied under /loop standing authorization)
Artifacts: `harness/artifacts/critic-plan-AN-001-*-1.md` (plan-rubric run),
`harness/artifacts/critic-analysis-AN-001-*-{1,2}.md`.
Cycle 1 (wrong rubric — plan criteria applied to an analysis doc): harness
gained a dedicated `analysis` mode; the framework-behavior BLOCKER was FIXED
with quoted `start-server-core` evidence. Cycle 2 findings FIXED: middleware
`data` chain quoted from `start-client-core/createServerFn.js:62-70,121-124`;
null-input fallback hazard addressed (`!== undefined`, adopted in MP-002);
terminal-section evidence quoted (Terminal.tsx, caddy-terminal.snippet).
Cycle 3 dispositions:
- [MAJOR] client `?payload=` serialization unevidenced → FALSE: empirically
  proven by the 21 live captured request URLs in screen-defects-2.md
  (`grep -c 'payload=%7B' .planning/harness/artifacts/screen-defects-2.md` → 21);
  evidence reference added to the doc.
- [MAJOR] client.ts stub claims unevidenced in that gate run → FIXED:
  orchestrator verified `grep -n notYetWired client.ts` → :457,664-679
  (file had been embedded in the cycle-2 run, omitted from cycle 3 to bound
  prompt size).
- [MAJOR] §5 leaned on stale pty-bridge comments → FIXED: stale citation
  removed as load-bearing; conclusion now rests on Terminal.tsx,
  caddy-terminal.snippet, and the shipped cortex-terminal sidecar.
Escalation handling: user's standing /loop directive ("dont stop until
everything is done") + two prior "Proceed (Recommended)" approvals; all
dispositions logged here, none silent. MP-002 — the operative
implementation contract — passes its own plan gate before any code change.

## 2026-06-10 — MP-002 implementation gates (all PASS) + G3 amendment
- Plan gate PASS cycle 2 (zero findings). Implementer report IMPL-COMPLETE
  (commit `5412149`): RED reproduced the exact production 400 body, GREEN
  2/2, suite 451/451, tsc clean, exactly 4 owned files.
- Independent m27-hs verification: tsc exit 0, vitest 35 files / 451 tests
  exit 0. Kimi diff gate PASS; 2 MINOR accepted as logged debt (redundant
  `& { inputData?: TIn }` intersection in server-fn-runner.server.ts:23;
  stale comment in mp-002-get-input.test.ts:46) — cosmetic, candidates for
  a later cleanup pass.
- G3 (eslint) AMENDED: `pnpm --filter @cortexos/dashboard-next lint` fails
  with 11,106 pre-existing problems unrelated to this work (verified: zero
  eslint findings intersect MP-002's changed lines — define-server-fn.ts:133,145,
  server-fn-runner.server.ts:23-25, server-fn-pipeline.ts:83-92,184 — and
  the new test file is clean). G3 for this effort = "no new violations on
  changed lines". Full-package lint cleanup is pre-existing debt, surfaced
  to the operator as a separate decision.

## 2026-06-10 — AN-002 analysis (3 cycles, dispositions applied under /loop standing authorization)
Artifacts: `harness/artifacts/critic-analysis-AN-002-healthcheck-hydration.md-{1,2,3}.md`.
Cycles 1-2 findings FIXED with orchestrator-verified greps (no dehydration
wiring; zero time/random/locale text in DataTable.tsx + StatusBadge.tsx;
ms() implementation quoted). Cycle 3 dispositions:
- [MAJOR] LogViewer rendering step unevidenced → FIXED: LogViewer.tsx:16
  `lines.map(...)` renders each line as a text node; quote added to the doc.
- [MAJOR] DataTable not ruled out ("server data vs client skeleton can
  differ") → OVERRULED: the scenario requires an SSR data fetch; the
  /healthcheck route has no loader (`grep -n loader
  src/routes/_authenticated.healthcheck.tsx` → zero matches) and the
  package has no prefetch/dehydration wiring (zero-match grep, in doc), so
  SSR and client hydration both render the pending state. Residual risk is
  bounded by MP-003 acceptance A4: if any second mismatch source exists,
  the post-fix screen re-run still FAILs /healthcheck and the loop
  continues — the exclusion is empirically tested, not assumed.
- [MAJOR] "No SSR fetch" unproven / wording contradiction → OVERRULED:
  same rationale and same empirical backstop as above.
Critic's own counterargument concedes the diagnosis is "very plausible" and
the fix "small and likely beneficial even if other sources exist."

## 2026-06-10 — MP-004 plan (3 cycles, dispositions applied under /loop standing authorization)
Artifacts: `harness/artifacts/critic-plan-MP-004-verify-screens-terminal-artifact.md-{1,2,3}.md`.
Cycles 1-2 findings FIXED (path typo in A2; defect/evidence line-cites added;
binary narrowness + printed-not-dropped checks added). Cycle 3 dispositions,
all FIXED:
- [BLOCKER] allowlist regex matched only the message prefix and would mask
  other terminal WS failures → pattern now includes the full
  "Error during WebSocket handshake: Unexpected response code: 404" tail.
- [MAJOR] A2 did not pin route/pattern contents → added exact-content greps
  on the awk slice (`route: '/terminal'`, the 404 tail).
- [MAJOR] A4 diff method contradicted its exclusions → expected-diff set now
  explicit: exactly `/terminal FAIL→PASS` (+ known-artifact line), /overview
  + /healthcheck owned elsewhere, any other diff line fails.
No overrules.

## 2026-06-10 — MP-003 gate-command amendment (post-gate, evidence-driven)
M3 reported IMPL-BLOCKED at Task 3: sourcing `dashboard.env` exports
`NODE_ENV=production` into vitest → 50 failures across 14
@testing-library files (M3 stash-verified they reproduce without its
change). Orchestrator isolation runs:
- `NODE_ENV=test` reduces failures to exactly 11 in
  `DataTable.test.tsx` + `useAuth.test.tsx` — all
  "No Start context found in AsyncLocalStorage" (direct server-fn calls
  from jsdom; the pattern AGENTS.md documents as unsupported).
- Same 11 fail with the LogStream change stashed AND with the three MP-002
  files reverted to `894590f` — pre-existing debt, not a regression.
Amendment to the gate-PASSed MP-003 (not re-gated; mechanical test-runner
env fix + evidenced baseline, logged here per rule 4's no-silent-changes
intent; kimi diff gate still guards the code): Task 3 adds
`export NODE_ENV=test` and an 11-failure baseline scoped to those two
files; A2 requires zero failures outside it.
OPERATOR FLAG: the 11 broken tests + dashboard.env's NODE_ENV leaking into
dev tooling deserve their own cleanup item; out of scope here.

## 2026-06-10 — MP-004 diff gates (3 cycles, dispositions applied under /loop standing authorization)
Artifacts: `harness/artifacts/critic-diff-45a3837-{1,2,3}.md` (combined diff
`f908922~1..HEAD`, verify-screens.mjs).
- Cycle 1 PASS + MAJOR (known-artifact printed only in fails loop) →
  FIXED in `ca4a5af` (print for all routes).
- Cycle 2 REJECT BLOCKER (M3's hoist in `3cbf5e9` computed the filters
  BEFORE page.goto — console errors silently ignored for ALL routes;
  invalidated verification run 5's class-(b) results) → FIXED in `0d284b1`
  (declare at route scope, assign after page events; ordering
  orchestrator-verified by line inspection).
- Cycle 3 REJECT MAJOR (all-routes artifact section lacks the literal
  `known-artifact:` prefix A4(i) greps for) → FIXED in the MP-004 fix-4
  commit (one-string change). Confirmation kimi gate runs on the final
  combined diff before push per rule 9.
No overrules. The gate caught a real observability-corrupting defect
(cycle 2) that static checks and the implementer's self-review missed.

## 2026-06-10 — MP-005 plan (3 cycles, dispositions applied under /loop standing authorization)
Artifacts: `harness/artifacts/critic-plan-MP-005-verify-screens-structural-boundary-check.md-{1,2,3}.md`.
Cycle 1 findings FIXED (superseded-evidence contradiction stated explicitly;
line cites added; executable sensitivity fixtures added). Cycle 2 findings
FIXED (EmptyState `<h3>` surface added to selector + fixtures; fixtures
reordered RED-first). Cycle 3 dispositions:
- [MAJOR] Systemd.tsx:224 not in evidence base → FIXED-BY-VERIFICATION:
  orchestrator ran `grep -n -A4 'Failed to load' src/features/Systemd.tsx`
  → `224: title="Failed to load units"`; file omitted from the embed set
  only to bound prompt size.
- [MAJOR] screen-defects-5.md not in evidence base → FIXED-BY-VERIFICATION:
  artifact exists; :32 is the `/processes FAIL error-boundary` row, quoted
  earlier in this log's run-5 analysis.
- [MAJOR] A4 deferred to orchestrator → OVERRULED: deliberate design,
  identical to the accepted A-criteria pattern in MP-002 (A4/A5), MP-003
  (A4), MP-004 (A4); implementer-verifiable completion is A1-A3 (binary,
  local); A4 is the orchestrator's pre-push gate. Same critic accepted this
  pattern in MP-003's PASS (cycle 2).
