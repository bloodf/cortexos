/**
 * V12 — Pending approvals materialized view.
 *
 * The dashboard renders `/approvals` from this Postgres table. The consumer
 * writes a row when entering `awaitSignal(runId, signalName, timeout)` and
 * marks it resolved on signal receipt or timeout.
 *
 * PG access is optional — if `DATABASE_URL` (or DB_* env vars) are missing
 * the module degrades to no-ops so a single-host dev deployment without a
 * Postgres instance can still exercise approvals via the NATS layer.
 */
let pgModule = null;
let poolInstance = null;
let pgUnavailable = false;

async function getPool() {
  if (pgUnavailable) return null;
  if (poolInstance) return poolInstance;
  try {
    if (!pgModule) pgModule = (await import("pg")).default;
  } catch {
    pgUnavailable = true;
    return null;
  }
  const dsn = process.env.PENDING_APPROVALS_DATABASE_URL
    || process.env.DATABASE_URL
    || process.env.CORTEX_DASHBOARD_DATABASE_URL
    || "";
  if (dsn) {
    poolInstance = new pgModule.Pool({ connectionString: dsn, max: 4, idleTimeoutMillis: 30_000 });
  } else if (process.env.DB_HOST || process.env.DB_PASSWORD) {
    poolInstance = new pgModule.Pool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || "cortex_dashboard",
      user: process.env.DB_USER || "dashboard",
      password: process.env.DB_PASSWORD,
      max: 4,
      idleTimeoutMillis: 30_000,
    });
  } else {
    pgUnavailable = true;
    return null;
  }
  poolInstance.on("error", (err) => {
    process.stderr.write(`[pending-approvals] idle client error: ${err.message}\n`);
  });
  return poolInstance;
}

export async function recordPending({ runId, signalName, role, issueId, reason, timeoutSec }) {
  const pool = await getPool();
  if (!pool) return false;
  const timeoutAt = timeoutSec ? new Date(Date.now() + timeoutSec * 1000) : null;
  try {
    await pool.query(
      `INSERT INTO pending_approvals (run_id, signal_name, role, issue_id, reason, timeout_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (run_id, signal_name) DO UPDATE
         SET requested_at = now(),
             role = EXCLUDED.role,
             issue_id = EXCLUDED.issue_id,
             reason = EXCLUDED.reason,
             timeout_at = EXCLUDED.timeout_at,
             resolved_at = NULL,
             decision = NULL,
             approver = NULL`,
      [runId, signalName, role || null, issueId || null, reason || null, timeoutAt],
    );
    return true;
  } catch (e) {
    if (e && e.code === "42P01") {
      // table not present — degraded mode.
      return false;
    }
    process.stderr.write(`[pending-approvals] insert failed run=${runId}: ${e.message}\n`);
    return false;
  }
}

export async function resolvePending({ runId, signalName, decision, approver }) {
  const pool = await getPool();
  if (!pool) return false;
  try {
    await pool.query(
      `UPDATE pending_approvals
         SET resolved_at = now(), decision = $1, approver = $2
       WHERE run_id = $3 AND signal_name = $4 AND resolved_at IS NULL`,
      [decision, approver || null, runId, signalName],
    );
    return true;
  } catch (e) {
    if (e && e.code === "42P01") return false;
    process.stderr.write(`[pending-approvals] resolve failed run=${runId}: ${e.message}\n`);
    return false;
  }
}

export async function closePool() {
  if (poolInstance) {
    try { await poolInstance.end(); } catch { /* noop */ }
    poolInstance = null;
  }
}
