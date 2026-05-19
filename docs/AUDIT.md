# CortexOS Audit Log

Hash-chained, append-only audit log over TimescaleDB with periodic Sigstore
Rekor anchoring. Introduced in V9.

## Goals

1. **Tamper-evidence** for every CortexOS state transition (paperclip work
   acceptance, status emit, bridge inbound/outbound, ...) without requiring
   trust in the dashboard operator.
2. **External verifiability** of chain heads via Rekor's public transparency
   log, so a third party can prove the chain existed at anchor time without
   talking to CortexOS infrastructure.
3. **Continuity** of the production path even if the audit subsystem fails
   — degraded audit beats stalled paperclip runs.

## Schema

Migration: `packages/cortex-dashboard/migrations/008_audit_log.sql`.

```text
audit_log (
  id              BIGSERIAL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_id        UUID        NOT NULL,
  event_type      TEXT        NOT NULL,
  source          TEXT        NOT NULL,
  subject         TEXT,
  actor           TEXT,
  payload_hash    TEXT        NOT NULL,   -- SHA-256(JCS(payload)), hex
  prev_hash       TEXT        NOT NULL,   -- previous row's chain_hash
  chain_hash      TEXT        NOT NULL,   -- SHA-256(prev || payload_hash)
  rekor_log_index BIGINT,                 -- non-null on anchored rows
  payload         JSONB       NOT NULL,
  PRIMARY KEY (occurred_at, id)
)
```

Promoted to a hypertable via `create_hypertable('audit_log', 'occurred_at')`.

### TimescaleDB image swap-in

Stock Postgres lacks the TimescaleDB extension. The compose stacks should be
moved to `timescale/timescaledb-ha:pg16` (or matching major). The migration
calls `CREATE EXTENSION IF NOT EXISTS timescaledb` and is otherwise
back-compatible, so the swap is:

1. Drain dashboard + bridge workloads.
2. Stop Postgres, swap the image tag, restart.
3. Re-run migrations (`pnpm --filter @cortexos/dashboard run migrate` or operator
   wrapper). The 008 migration enables the extension and creates the
   hypertable in-place.

Rollback (`008_audit_log.rollback.sql`) drops the table and indexes but does
**not** drop the extension because it may be shared.

## Hash-chain construction

```text
payload_hash = SHA-256( JCS(payload) )           // bytes
chain_hash   = SHA-256( prev_hash || payload_hash ) // raw hex-decoded bytes
```

- `JCS` follows the same canonicalization the consumer already uses for
  NATS HMAC envelopes (`stacks/cortex-consumer/consumer.js#jcs`). Stable
  lexicographic key order; no number-format normalisation needed because
  payloads originate from CloudEvents envelopes that never contain
  NaN/Inf.
- `prev_hash` of the genesis row is `0` repeated 64 times.

### Concurrency

`append()` runs in a transaction. It opens with:

```sql
SELECT chain_hash
  FROM audit_log
 ORDER BY occurred_at DESC, id DESC
 LIMIT 1
 FOR UPDATE;
```

`FOR UPDATE` takes a row lock on the current tip, serialising concurrent
appenders at the database level. The chain is therefore strict-serialisable.
Pool size limits how many appenders can race; the tip lock guarantees no
duplicate or branched chain segments.

### Non-blocking failure contract

Production code wraps `append()` in `safeAuditAppend()` which catches all
errors, logs them, and emits a NATS alert:

```text
cortex.alerts.error.audit-append-failed
```

The original operation (paperclip transition, bridge enqueue, ...) is
**never blocked**. Audit gaps therefore appear as `prev_hash_mismatch`
errors during `verifyChain`, not as production outages. This trade-off is
deliberate: a tamper-evident-but-occasionally-gappy log is preferable to a
tamper-evident-but-blocking-on-Postgres-outage log.

To bypass audit entirely (e.g. break-glass debug), set
`CORTEX_AUDIT_ENABLED=0`. Gaps introduced this way are visible because
known transitions will be absent and `verifyChain` still returns intact.

## Rekor anchoring

Anchor-by-tip: a single Rekor `hashedrekord` entry covers every row up to
and including the current tip. Only the tip row receives a
`rekor_log_index` write. Subsequent rows inherit coverage transitively via
the chain.

Anchor cadence: hourly (`scripts/audit-anchor-cron.sh`). Operator hooks the
script into systemd via:

```ini
[Service]
Type=oneshot
ExecStart=/opt/cortexos/scripts/audit-anchor-cron.sh
EnvironmentFile=/opt/cortexos/.secrets/dashboard.env

[Timer]
OnCalendar=hourly
Persistent=true
```

The CLI verifies the chain before uploading. A broken chain causes
non-zero exit (`2`) and skips the upload, so the operator sees an alert
without poisoning the transparency log with a tampered head.

Signing keys are ephemeral ed25519 keypairs generated per anchor and
discarded. The goal is tamper-detection, not non-repudiation; Rekor only
requires that the signature verifies against the supplied public key.

## Tamper-detection procedure

1. **Continuous:** `verifyChain(fromTs, toTs)` recomputes the chain over a
   window. The dashboard audit viewer at `/audit` triggers it for the
   current page; the `cortex-audit verify` CLI runs it from operator
   shells.
2. **Pre-anchor:** the hourly cron verifies before anchoring. Failure
   raises `cortex.alerts.error.audit-append-failed` (gap) or exits non-zero
   (chain break) — operator follows the runbook below.
3. **External:** retrieve a known `rekor_log_index` from the audit_log
   table, fetch the Rekor inclusion proof via
   `https://rekor.sigstore.dev/api/v1/log/entries/<uuid>`, and confirm the
   digest matches the row's `chain_hash`. Any mismatch means the chain has
   been altered after anchoring.

### Runbook: chain broken

1. Stop all writers (consumer, bridge). The chain must not extend over a
   broken segment.
2. Run `cortex-audit verify --from <last_known_good_ts>` to locate the
   first `brokenAt` row.
3. `pg_dump` the surrounding rows for forensic review. Compare against the
   NATS DLQ + paperclip artifacts to determine whether the gap is
   tampering or a known audit-append failure (alert history).
4. If tampering is confirmed: rotate `CORTEX_NATS_HMAC`, rotate dashboard
   DB credentials, file an incident, and replay the affected paperclip
   runs from Paperclip's authoritative log.
5. If only an append-failure gap: insert a sentinel row documenting the
   gap (with `event_type=cortex.audit.gap.acknowledged`) and resume
   writers.

## API surface

- `@cortexos/audit` package (`packages/cortex-audit`):
  - `append(event, opts?)` — transactional row insert.
  - `verifyChain(fromTs?, toTs?, opts?)` — recompute + diagnose.
  - `anchorToRekor(batchSinceTs?, opts?)` — anchor latest tip.
  - `payloadHashOf(payload)`, `chainHashOf(prev, payload)` — primitives.
  - CLI `cortex-audit verify|anchor`.
- `GET /api/audit/verify?from=&to=` — admin-gated verification endpoint.
- `/<locale>/audit` — paginated viewer with live chain-verify badge.

## See also

- `docs/SECURITY.md` § audit immutability.
- `docs/NATS-CONTRACT.md` for the alert subject schema.
- `docs/POSTGRES-LAYOUT.md` for hypertable placement.
