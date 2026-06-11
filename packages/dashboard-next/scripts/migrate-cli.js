/**
 * Standalone migration CLI for the Cortex Dashboard.
 * Runs SQL migrations against the production Postgres database.
 * This script is used by the Docker entrypoint and can also be run
 * manually before starting the dashboard service.
 *
 * Usage:
 *   node scripts/migrate-cli.js
 *
 * Required env vars: DB_PASSWORD
 * Optional env vars: DB_HOST, DB_PORT, DB_NAME, DB_USER
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { Client } from "pg";

const SAFE_FILENAME_RE = /^[a-zA-Z0-9_-]+\.sql$/;

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

async function main() {
  const env = readDbEnv();
  const client = new Client(env);
  await client.connect();

  try {
    // Bootstrap migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const { rows: appliedRows } = await client.query("SELECT name FROM migrations ORDER BY name");
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    const migrationsDir = join(process.cwd(), "migrations");
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql") && SAFE_FILENAME_RE.test(f))
      .sort();

    const lanIp = getLanIp();
    let ran = 0;

    /* eslint-disable no-restricted-syntax, no-await-in-loop */
    for (const file of files) {
      const name = file.replace(/\.sql$/, "");
      if (!appliedSet.has(name)) {
        const filePath = join(migrationsDir, file);
        if (filePath.startsWith(migrationsDir)) {
          let sql = readFileSync(filePath, "utf-8");
          if (lanIp) {
            sql = sql.replace(/<VPS_LAN_IP>/g, lanIp);
          }

          await client.query(sql);
          await client.query(
            "INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
            [name],
          );
          console.info(`  ✓ ${name}`);
          ran += 1;
        }
      }
    }
    /* eslint-enable no-restricted-syntax, no-await-in-loop */

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
