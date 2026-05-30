#!/usr/bin/env node
/**
 * Compiled migration runner. Self-contained — does not import from src/.
 * Invoked by the dashboard container entrypoint (`docker-entrypoint.sh`)
 * before the Next.js server boots; mirrors `src/lib/db/migrate.ts`.
 */
const { readdirSync, readFileSync } = require("fs");
const { join } = require("path");
const os = require("os");

function getLanIp() {
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.internal || addr.family !== "IPv4") continue;
      candidates.push({ ip: addr.address, source: name });
    }
  }
  const score = (s) => {
    const x = s.toLowerCase();
    if (x.startsWith("eth") || x.startsWith("en")) return 1;
    if (x.startsWith("wl") || x.startsWith("wlan")) return 2;
    if (x.startsWith("tailscale")) return 4;
    return 3;
  };
  candidates.sort((a, b) => score(a.source) - score(b.source));
  return candidates[0]?.ip;
}

function getClientCtor(pg) {
  return pg.Client || pg.default?.Client;
}

async function main() {
  const pgPath = require.resolve("pg", {
    paths: [join(__dirname, "..", "node_modules")],
  });
  const pg = require(pgPath);
  const ClientCtor = getClientCtor(pg);
  if (!ClientCtor) {
    throw new TypeError("pg.Client constructor unavailable");
  }

  if (!process.env.DB_PASSWORD) {
    throw new Error("DB_PASSWORD environment variable is required");
  }

  const client = new ClientCtor({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "cortex_dashboard",
    user: process.env.DB_USER || "dashboard",
    password: process.env.DB_PASSWORD,
  });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const applied = await client.query("SELECT name FROM migrations ORDER BY name");
  const appliedSet = new Set(applied.rows.map((r) => r.name));

  const MIGRATIONS_DIR = join(__dirname, "..", "migrations");
  const SAFE = /^[a-zA-Z0-9_-]+\.sql$/;
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && SAFE.test(f))
    .sort();

  const lanIp = getLanIp();
  const run = [];

  for (const file of files) {
    const name = file.replace(".sql", "");
    if (appliedSet.has(name)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    const finalSql = lanIp ? sql.replace(/<VPS_LAN_IP>/g, lanIp) : sql;
    console.log(`Applying ${name}...`);
    await client.query(finalSql);
    await client.query(
      "INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
      [name],
    );
    run.push(name);
  }

  console.log(run.length ? `Applied: ${run.join(", ")}` : "No pending migrations");
  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
