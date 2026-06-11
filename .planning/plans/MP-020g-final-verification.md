# MP-020g — final verification + release (orchestrator-executed)

Runs ONLY after MP-020b..f are committed, each with a PASS/adjudicated
gpt-5.5 diff review. No worker edits in this unit.

## Tasks
1. TRUE-ZERO check: `pnpm exec eslint . 2>&1 | tail -1` →
   `✖ 0 problems` EXACTLY. If nonzero: every residual is a defect in a
   prior wave — route back, do not adjudicate.
2. Suppression audit over the campaign range:
   `git diff <MP-020 start SHA>..HEAD | grep -cE '^\+.*eslint-disable'`
   → 0, AND repo-wide
   `grep -rn 'eslint-disable' packages/*/src packages/*/bin packages/*/scripts | wc -l`
   → 0 (the legacy 14 are gone; none remain anywhere in first-party
   source).
3. Config-scope audit: `grep -n 'MP-020' eslint.config.js` — exactly the
   approved scopes (env-modules glob, scripts devDependencies, the
   only-throw-error allow extension), each commented.
4. Full battery: tsc 0; dashboard suite (new total ≥ 558 + golden tests)
   zero failures; build; contracts 243/243; audit; telemetry;
   mail-guardian build+test; terminal node --check;
   format:check exit 0.
5. Service verification: restart cortex-dashboard.service +
   cortex-terminal.service (and mail-guardian's run-context if
   service-managed) — all active, probes 200/green.
6. Deploy verification: dashboard rebuild → boot test 200 → restart →
   screens run (18/18) with explicit eyes on /env-browser + /terminal.
7. Push. Ledger: GATE-RESOLUTION "MP-020 CLOSE" entry (per-wave SHAs,
   review verdicts, the zero-proof quotes). Update memory
   (lint-campaign-final-state → TRUE ZERO baseline; any new finding is
   a regression). STATUS.md row.

## Acceptance
- All seven checks quoted green in the ledger entry; origin/main carries
  everything; tree clean.
