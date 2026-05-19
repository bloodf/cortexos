#!/bin/bash
set -e

: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=5432}"
: "${DB_NAME:=cortex_dashboard}"
: "${DB_USER:=dashboard}"
: "${PORT:=3080}"

if [[ -z "${DB_PASSWORD:-}" ]]; then
  echo "DB_PASSWORD env var is required" >&2
  exit 1
fi

echo "=== Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT} ==="
until PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  echo "  PostgreSQL not ready, retrying in 2s..."
  sleep 2
done
echo "  PostgreSQL ready"

echo "=== Running migrations ==="
node scripts/migrate.js

echo "=== Dynamic services-catalog seed ==="
node scripts/dynamic-seed.js || {
  # Never block dashboard startup on a probe failure — defaults from
  # 002_seed.sql + 010_services_catalog_extras.sql are still safe.
  echo "  WARN: dynamic-seed.js failed (non-fatal); continuing" >&2
}

echo "=== Starting dashboard on port ${PORT} ==="
exec node server.js
