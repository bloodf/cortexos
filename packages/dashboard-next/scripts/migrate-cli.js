/**
 * Standalone migration CLI for the Cortex Dashboard.
 *
 * Runs the SQL migrations in `migrations/` against the production Postgres
 * database. This is the de-facto way migrations get applied in the native
 * systemd deployment: the dashboard does NOT auto-apply migrations on
 * service restart, so after adding a migration you must run this CLI by
 * hand before restarting `cortex-dashboard.service`.
 *
 * Usage (from the package dir, packages/dashboard-next):
 *   DB_PASSWORD=… node scripts/migrate-cli.js
 *
 * Required env vars: DB_PASSWORD
 * Optional env vars: DB_HOST, DB_PORT, DB_NAME, DB_USER
 *
 * Ledger — IMPORTANT (must stay in sync with src/server/db/migrate.ts):
 *   This CLI records applied migrations into the SAME namespaced,
 *   checksum-verified ledger as the in-app runner `runSqlMigrations`
 *   (`src/server/db/migrate.ts`): `dashboard_migrations`
 *   `(id, name UNIQUE, checksum CHAR(64), applied_at)`. It deliberately
 *   re-implements that runner's semantics (it cannot import the TS module
 *   from a plain-node CLI context) — checksum = sha256(RAW file content,
 *   computed BEFORE `<VPS_LAN_IP>` substitution so it is host-stable),
 *   one-time reconciliation that backfills `dashboard_migrations` from the
 *   legacy shared `migrations` table for ONLY this dir's names, and loud
 *   drift detection that never re-applies. Because both this CLI and the
 *   in-app runner read/write the same ledger, neither re-applies what the
 *   other already recorded.
 *
 *   The legacy shared `migrations` table (root / SvelteKit / dashboard-next
 *   mixed lineage) is NO LONGER the source of truth; it is only read once,
 *   during reconciliation. Do not point this CLI back at it.
 *
 * Note: any deeper unification onto a single shared code path (importing
 * `runSqlMigrations` directly) needs a build/loader step for the TS module
 * and is intentionally NOT done here.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { Client } from "pg";

const SAFE_FILENAME_RE = /^[a-zA-Z0-9_-]+\.sql$/;

/** Ledger table name — must match LEDGER_TABLE in src/server/db/migrate.ts. */
const LEDGER_TABLE = "dashboard_migrations";

const runSequentially = (items, fn) =>
  items.reduce((p, item, i) => p.then(() => fn(item, i)), Promise.resolve());

function readDbEnv() {
  if (!process.env.DB_PASSWORD) {
    throw new Error("DB_PASSWORD environment variable is required");
  }
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "cortex_dashboard",
    user: process.env.DB_USER || "dashboard",
    password: process.env.DB_PASSWORD,
  };
}

/**
 * sha256 hex of RAW file content (pre-substitution). Mirrors
 * `migrationChecksum` in src/server/db/migrate.ts so the two runners
 * produce identical ledger checksums for the same file.
 */
function migrationChecksum(rawSql) {
  return createHash("sha256").update(rawSql, "utf-8").digest("hex");
}

function getLanIp() {
  const ifaces = os.networkInterfaces();
  const candidates = [];
  Object.entries(ifaces).forEach(([name, addrs]) => {
    if (!addrs) return;
    addrs.forEach((addr) => {
      if (addr.internal || addr.family !== "IPv4") return;
      candidates.push({ ip: addr.address, source: name });
    });
  });
  const score = (source) => {
    const s = source.toLowerCase();
    if (s.startsWith("eth") || s.startsWith("en")) return 1;
    if (s.startsWith("wl") || s.startsWith("wl")) return 2;
    if (s.startsWith("tailscale")) return 4;
    return 3;
  };
  candidates.sort((a, b) => score(a.source) - score(b.source));
  return candidates[0]?.ip;
}

/**
 * Best-effort relation-exists probe, used to guard the legacy-table read
 * during reconciliation. Mirrors `relationExists` in
 * src/server/db/migrate.ts.
 */
async function relationExists(client, table) {
  try {
    const { rows } = await client.query("SELECT to_regclass($1) AS reg", [table]);
    return rows[0]?.reg != null;
  } catch {
    return false;
  }
}

async function main() {
  const env = readDbEnv();
  const client = new Client(env);
  await client.connect();

  try {
    // Bootstrap the NAMESPACED, checksum-verified ledger (not the legacy
    // shared `migrations` table). Safe to re-run.
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const migrationsDir = join(process.cwd(), "migrations");
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql") && SAFE_FILENAME_RE.test(f))
      .sort();
    const entries = files.map((file) => {
      const filePath = join(migrationsDir, file);
      const rawSql = readFileSync(filePath, "utf-8");
      return {
        file,
        filePath,
        name: file.replace(/\.sql$/, ""),
        rawSql,
        checksum: migrationChecksum(rawSql),
      };
    });

    // RECONCILIATION (one-time, automatic, idempotent). If the namespaced
    // ledger is empty AND the legacy shared `migrations` table exists with
    // rows, backfill `dashboard_migrations` for ONLY the names matching
    // files in THIS dir — so a DB where these were already applied under
    // the legacy ledger transitions WITHOUT re-running anything. Mirrors
    // runSqlMigrations.
    const { rows: ledgerCountRows } = await client.query(
      `SELECT COUNT(*) AS n FROM ${LEDGER_TABLE}`,
    );
    const ledgerIsEmpty = Number(ledgerCountRows[0]?.n ?? 0) === 0;
    if (ledgerIsEmpty && (await relationExists(client, "migrations"))) {
      const { rows: legacyRows } = await client.query("SELECT name FROM migrations");
      const legacyNames = new Set(legacyRows.map((r) => r.name));
      const toBackfill = entries.filter((e) => legacyNames.has(e.name));
      await runSequentially(toBackfill, async (e) => {
        await client.query(
          `INSERT INTO ${LEDGER_TABLE} (name, checksum) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
          [e.name, e.checksum],
        );
      });
    }

    // Build the recorded-set + stored checksums from the namespaced ledger.
    const { rows: appliedRows } = await client.query(
      `SELECT name, checksum FROM ${LEDGER_TABLE} ORDER BY name`,
    );
    const appliedChecksums = new Map(appliedRows.map((r) => [r.name, r.checksum]));

    // CHECKSUM DRIFT DETECTION: warn loudly if an already-recorded
    // migration's current file checksum differs from the stored one; never
    // re-apply or auto-mutate. Mirrors runSqlMigrations.
    entries.forEach((e) => {
      const stored = appliedChecksums.get(e.name);
      if (stored !== undefined && stored !== e.checksum) {
        console.warn(
          `[migrate] checksum drift for already-applied migration "${e.name}": ` +
            `stored=${stored} current=${e.checksum}. The file content changed ` +
            `after it was applied. Skipping re-apply (not auto-mutating); ` +
            `reconcile manually if this is intentional.`,
        );
      }
    });

    const lanIp = getLanIp();
    const pending = entries.filter((e) => !appliedChecksums.has(e.name));
    let ran = 0;

    await runSequentially(pending, async ({ filePath, name, rawSql, checksum }) => {
      // Defence-in-depth: ensure the resolved path is still inside the dir.
      if (!filePath.startsWith(migrationsDir)) return;
      const finalSql = lanIp ? rawSql.replace(/<VPS_LAN_IP>/g, lanIp) : rawSql;

      await client.query(finalSql);
      await client.query(
        `INSERT INTO ${LEDGER_TABLE} (name, checksum) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
        [name, checksum],
      );
      console.info(`  ✓ ${name}`);
      ran += 1;
    });

    if (ran === 0) {
      console.info("  (no new migrations)");
    } else {
      console.info(`  Applied ${ran} migration(s).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  throw e;
});
