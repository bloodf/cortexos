#!/bin/bash
set -e

echo "=== Waiting for PostgreSQL ==="
until PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  echo "  PostgreSQL not ready, retrying in 2s..."
  sleep 2
done
echo "  PostgreSQL ready"

echo "=== Running migrations ==="
node <<'NODE'
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'cortex_dashboard',
  user: process.env.DB_USER || 'dashboard',
  password: process.env.DB_PASSWORD,
});
function lanIp() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs || []) {
      if (!addr.internal && addr.family === 'IPv4') return addr.address;
    }
  }
  return undefined;
}
(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS migrations (id SERIAL PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL, applied_at TIMESTAMP DEFAULT NOW())`);
  const applied = new Set((await pool.query('SELECT name FROM migrations')).rows.map((r) => r.name));
  const dir = path.join(process.cwd(), 'migrations');
  const ip = lanIp();
  const files = fs.readdirSync(dir).filter((f) => /^[a-zA-Z0-9_-]+\.sql$/.test(f)).sort();
  const run = [];
  for (const file of files) {
    const name = file.replace(/\.sql$/, '');
    if (applied.has(name)) continue;
    let sql = fs.readFileSync(path.join(dir, file), 'utf8');
    if (ip) sql = sql.replace(/<VPS_LAN_IP>/g, ip);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
      await pool.query('COMMIT');
      run.push(name);
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }
  console.log('  Applied migrations:', run.length ? run.join(', ') : 'none');
})().finally(() => pool.end()).catch((err) => { console.error(err); process.exit(1); });
NODE
echo "  Migrations complete"

echo "=== Starting dashboard on port $PORT ==="
exec node server.js
