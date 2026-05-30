# Audit

Audit requirements for the rebuild:

- Dashboard helper command metadata goes to Postgres and journald.
- Obot writes JSON audit lines for every request.
- Backup and restore verification evidence is stored with backup artifacts and
  summarized in `PLAN.md`.
- Hash-chain helpers in `packages/cortex-audit` remain available for dashboard
  audit tables.
