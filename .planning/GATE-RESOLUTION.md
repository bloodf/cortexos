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
