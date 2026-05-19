# Paperclip ↔ CortexOS — Historic OMC Backfill

> Stage 8. Replay archived OMC task records into Paperclip with
> `status="done"` and link them through `paperclip_ticket_link.omc_task_id`.
> Resumable. Idempotent. Dry-run gated.

## Goal

Reconstruct the audit trail in Paperclip for work that happened before
the bridge existed, without inventing data. Each synthetic Paperclip
issue is anchored to a stable `omc_task_id =
sha256(sessionId + role + earliestTimestamp).slice(0,16)` so re-running
the importer is a no-op via `ON CONFLICT (omc_task_id) DO NOTHING`.

## When to run

- Once per environment after migration `006_paperclip_omc_backfill.sql`
  is applied on the target database.
- Whenever a new batch of archived `.omx/logs/*.jsonl` or
  `.omc/state/sessions/*/*.json` records is recovered.
- Never on a database that hasn't been backed up in the last 24 hours.

## Prerequisites

- Migration 006 applied:

  ```bash
  psql "$PG_DSN" -c "\d paperclip_ticket_link" | grep -E 'omc_task_id|backfilled_at'
  ```

  Must show both columns. If missing, run `packages/cortex-dashboard/scripts/migrate.js` or
  `psql -f packages/cortex-dashboard/migrations/006_paperclip_omc_backfill.sql`.

- Env loaded (only required for `--apply`):

  ```bash
  source /opt/cortexos/.secrets/paperclip.env
  export PAPERCLIP_API_URL PAPERCLIP_API_KEY PG_DSN
  ```

- `cd scripts && npm install` once.


## Todo

- [ ] Pre-flight (2 min)
- [ ] Step 1 — Dry run (mandatory)
- [ ] CHECKPOINT 8.A confirmed
- [ ] Step 2 — Apply
- [ ] Step 3 — Parity check
- [ ] Step 4 — Resume / re-run
- [ ] Failure tags
- [ ] Done condition
## Pre-flight (2 min)

Inventory the source corpus so the dry-run summary has something to
compare against.

```bash
find .omx/logs -name '*.jsonl' -printf '%p\n' | wc -l
find .omx/logs -name '*.jsonl' -exec wc -l {} + | tail -n 1
find .omc/state/sessions -name '*.json' -printf '%p\n' | wc -l
```

Capture the totals — these are the upper bound on the importer's event
count.

## Step 1 — Dry run (mandatory)

```bash
cd scripts
npm run migrate-omc -- --dry-run --staging \
  | tee /tmp/omc-backfill.dry.json
```

The tail of the output is a JSON document with `mode: "dry-run"` and a
`summary` block:

```bash
jq '.summary.totalEvents, .summary.totalTasks' /tmp/omc-backfill.dry.json
jq '.summary.byRole' /tmp/omc-backfill.dry.json
```

Record these two numbers — they are the parity targets for step 3.

Optional time-window scoping:

```bash
npm run migrate-omc -- --dry-run \
  --from-date 2026-01-01 --to-date 2026-03-31
```

## CHECKPOINT 8.A — Dry-run review

**STOP — operator question:** Dry-run review?

STOP. Before continuing, confirm all of the following:

1. `totalEvents` is plausible (within 10% of the line counts from
   pre-flight; jsonl lines that lack `sessionId`/`role` are skipped on
   purpose).
2. `totalTasks` is non-zero and `byRole` covers the roles you expect to
   see (no surprise roles, no missing roles).
3. A database backup taken in the last 24h is available and verified.

If any item fails, stop and investigate. Do not pass --apply.

Type `confirmed` to proceed.
## Step 2 — Apply

```bash
npm run migrate-omc -- --apply \
  | tee /tmp/omc-backfill.apply.json
```

The CLI prints `[N/total] <omc_task_id> role=<role>` progress lines and
ends with a JSON object containing `summary` and `result`. Exit code is
`0` on success and `1` if any task failed end-to-end.

Inspect the result counters:

```bash
jq '.result' /tmp/omc-backfill.apply.json
```

- `created` — new Paperclip issues opened.
- `skippedConflict` — Paperclip returned 409 (already imported); the
  link row is still upserted, so this is healthy on re-runs.
- `linkInserted` / `linkSkipped` — DB-side idempotency counters.
- `failed` — must be `0` on a clean run.

## Step 3 — Parity check

```bash
psql "$PG_DSN" -c \
  "SELECT COUNT(*) FROM paperclip_ticket_link WHERE omc_task_id IS NOT NULL"
```

The count must equal the dry-run `totalTasks` (within `skippedConflict`
on subsequent runs — re-runs do not create new rows).

```bash
psql "$PG_DSN" -c \
  "SELECT cortex_role, COUNT(*) FROM paperclip_ticket_link
     WHERE backfilled_at IS NOT NULL GROUP BY cortex_role ORDER BY 2 DESC"
```

Cross-check the per-role breakdown against the `byRole` block from the
dry run.

## Step 4 — Resume / re-run

The importer is fully resumable. Running `--apply` a second time:

- Hits Paperclip with the same `x-paperclip-run-id` (the `omc_task_id`),
  which the server treats as idempotent — counted under
  `skippedConflict`.
- Uses `INSERT ... ON CONFLICT (omc_task_id) DO NOTHING` on the link
  table, so no duplicate link rows are written.

Interrupt with Ctrl-C if needed; the next run picks up wherever
Paperclip + Postgres left off.

## Rollback

Rollback is a database-level operation, owned by migration 006:

```bash
psql "$PG_DSN" -f packages/cortex-dashboard/migrations/006_paperclip_omc_backfill.rollback.sql
```

This drops the `omc_task_id` and `backfilled_at` columns. The
backfilled rows themselves remain in `paperclip_ticket_link` (status
`done`) unless you also delete them explicitly:

```sql
DELETE FROM paperclip_ticket_link WHERE backfilled_at IS NOT NULL;
```

Run the deletion only when the rollback intent is "erase the backfill
entirely". Otherwise keep the rows for audit continuity — they remain
queryable by `paperclip_run_id` (which still equals the original
`omc_task_id`).

## Failure tags

| Tag                              | Triage                                            |
| -------------------------------- | ------------------------------------------------- |
| `BACKFILL-FAIL:migration-006`    | Migration not applied. Apply 006, retry dry-run.  |
| `BACKFILL-FAIL:dry-run-empty`    | No events found. Verify `--omx-dir` / `--omc-dir`.|
| `BACKFILL-FAIL:apply-no-env`     | `PAPERCLIP_API_URL`/`_KEY`/`PG_DSN` not exported. |
| `BACKFILL-FAIL:result-failed-gt0`| Inspect `/tmp/omc-backfill.apply.json` for trace. |
| `BACKFILL-FAIL:parity-mismatch`  | Row count diverges from `totalTasks`. Investigate.|

## Done condition

- Dry-run JSON archived under `/tmp/omc-backfill.dry.json` and attached
  to the phase report.
- Apply JSON archived under `/tmp/omc-backfill.apply.json` with
  `result.failed = 0`.
- Parity check (Step 3) matches.
- `docs/PAPERCLIP.md` "Historic backfill" section reflects the run.
