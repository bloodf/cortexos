# MP-025 — flip the NINE notYetWired client stubs to the existing server fns

Evidence: recon-fable-dashboard-review.md CRITICAL-1. EXACTLY NINE stub
entries (orchestrator grep 2026-06-11): client.ts:875 alerts.rules, :876
alerts.history, :878 alerts.rulesList, :880 alerts.historyList, :884
approvals, :887 audit, :890 auditList, :905 agents, :936 envFiles. (The
10th 'notYetWired' occurrence is the helper definition at :669 — not an
entry.) The pages are live-importing; only the client surface lies.

## File ownership (NOTHING else)
- packages/dashboard-next/src/lib/api/client.ts (the NINE line-cited entries + needed imports + any tiny mapping helpers, which must live in this same file);
- ONE new test file packages/dashboard-next/src/lib/api/__tests__/client-live-surface.test.ts
  (node-env harness per the repo's established pattern);
- Report: artifacts/impl-mp-025-report.md (never committed).

## Tasks — TDD ORDER
0. RED: the new test file mocks the server-fn modules (vi.mock per
   domain functions module) and asserts each of the NINE api.* entries
   (the line-cited list above) CALLS the corresponding server fn and
   returns its mapped value instead of rejecting — run: exactly 9
   failures (quote).
1. GREEN: replace each stub with a call to its mapped server fn per the
   review ADDENDUM backend map (alerts.rules/rulesList → listAlerts
   alerts.functions.ts:91; alerts.history/historyList → alertHistory
   :215; approvals → listApprovals approvals.functions.ts:86;
   audit/auditList → listAudit approvals.functions.ts:367; agents →
   listAgents agents.functions.ts:72; envFiles → readEnv
   env-browser.functions.ts:175) — established accessor pattern; map
   rows with existing adapters; signatures IDENTICAL so consumers don't
   change. MAPPING CONTRACT (binary): each entry's DECLARED return type
   in client.ts (AlertRule[]/AlertHistory[]/AuditEntry[]/
   ApprovalRequest[]/Agent[]/ListResult<...>/unknown[]) is unchanged;
   the RED test asserts the resolved value structurally equals the
   mocked server-fn rows after mapping (field-by-field on one sample
   row per entry); any new mapping helpers are private functions inside
   client.ts (ownership above).
2. Live ground truth (binary, quote both): from /opt/cortexos with
   dashboard.env sourced,
   `psql ... -tA -c "SELECT count(*) FROM alert_history;"` → N1 > 0 and
   `psql ... -tA -c "SELECT count(*) FROM audit_log;"` → N2 > 0 (the
   repos read exactly these tables — repos/alerts.ts:7, repos/
   audit_events.ts:4); live row-flow through the flipped surface is then
   verified post-deploy by the screen run's server-fn 2xx checks on
   /alerts and /audit (verify-screens.mjs:150-184).
## Gates (binary, quote)
- tsc exit 0; full suite zero failures (≥597: 596 + new file);
- `grep -c 'notYetWired' packages/dashboard-next/src/lib/api/client.ts`
  → 0 EXACTLY (all nine call sites replaced AND the now-unused helper
  deleted);
- build exit 0; format:check exit 0.
Commit: fix(dashboard-next): flip Wave-1 client stubs to the implemented server fns — alerts/audit/approvals/agents/env live (MP-025)
## Out of scope: the mock components (MP-026); page UI changes.
