# MP-025 — flip the 10 notYetWired client stubs to the existing server fns

Evidence: recon-fable-dashboard-review.md CRITICAL-1 (stub lines, consumer
lines, existing-backend cites). The pages are live-importing; only the
client surface lies.

## File ownership (NOTHING else)
- src/lib/api/client.ts (the 10 entries + needed imports);
- ONE new test file src/lib/api/__tests__/client-live-surface.test.ts
  (node-env harness per the repo's established pattern);
- Report: artifacts/impl-mp-025-report.md (never committed).

## Tasks — TDD ORDER
0. RED: the new test file mocks the server-fn modules (vi.mock per
   domain functions module) and asserts each of the 10 api.* entries
   CALLS the corresponding server fn and returns its mapped value
   (alerts.rules, alerts.history, alerts.rulesList, alerts.historyList,
   approvals, audit, auditList, agents, envFiles, + the 10th per the
   grep) instead of rejecting — run: 10 failures (quote).
1. GREEN: replace each stub with a call to the existing server fn
   (import from the domain .functions.ts per the established accessor
   pattern elsewhere in client.ts; map rows with existing adapters; keep
   signatures IDENTICAL so consumers don't change).
2. Live ground truth (quote): with a minted session per the headless
   recipe, OR via the repo test harness, evidence that alerts.history
   and audit return >0 rows matching psql counts
   (`SELECT count(*) FROM alert_history` etc. — name the real tables
   from the repos).
## Gates (binary, quote)
- tsc exit 0; full suite zero failures (≥597: 596 + new file);
- `grep -c 'notYetWired' src/lib/api/client.ts` → 2 (the helper
  definition + its doc line ONLY — zero call sites; quote the remaining
  lines proving they are not entries);
- build exit 0; format:check exit 0.
Commit: fix(dashboard-next): flip Wave-1 client stubs to the implemented server fns — alerts/audit/approvals/agents/env live (MP-025)
## Out of scope: the mock components (MP-026); page UI changes.
