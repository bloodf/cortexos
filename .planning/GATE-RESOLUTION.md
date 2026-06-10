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
