# PostgreSQL (latest)

## Purpose

Install PostgreSQL from the official PGDG apt repository; create the `cortex_dashboard` database and `dashboard` role used by the CortexOS dashboard.

## Prerequisites

- `11-docker.md` completed (Docker not required for PG, but Docker must be present for later stacks).
- `10-os-hardening.md` completed.

## CHECKPOINT 1

Operator: confirm no existing PostgreSQL instance is running on port 5432 (`ss -tlnp | grep 5432`). Type "confirmed" to proceed.

## Install

```bash
sudo apt-get install -y curl gnupg lsb-release
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | \
  sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt-get update -y
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

## Configure

```bash
# Create role and database
sudo -u postgres psql <<'SQL'
CREATE ROLE dashboard WITH LOGIN PASSWORD '{DASHBOARD_DB_PASSWORD}';
CREATE DATABASE cortex_dashboard OWNER dashboard;
GRANT ALL PRIVILEGES ON DATABASE cortex_dashboard TO dashboard;
SQL
```

Replace `{DASHBOARD_DB_PASSWORD}` with a strong random password. Write it to `/opt/cortexos/.secrets/dashboard.env`:

```bash
sudo mkdir -p /opt/cortexos/.secrets
sudo tee /opt/cortexos/.secrets/dashboard.env <<EOF
DATABASE_URL=postgresql://dashboard:{DASHBOARD_DB_PASSWORD}@127.0.0.1:5432/cortex_dashboard
EOF
sudo chmod 600 /opt/cortexos/.secrets/dashboard.env
```

Apply schema:

```bash
psql -U dashboard -h 127.0.0.1 cortex_dashboard < dashboard/migrations/001_schema.sql
psql -U dashboard -h 127.0.0.1 cortex_dashboard < dashboard/migrations/002_seed.sql
```

## Verify

```bash
psql -U dashboard -h 127.0.0.1 cortex_dashboard -c "\dt"
```

Expected: tables listed including `services`, `migrations`.

## CHECKPOINT 2

Operator: confirm `\dt` lists the schema tables and the `.secrets/dashboard.env` file exists with mode 600. Type "confirmed" to proceed.

## Next

→ `prompts/tools/15-redis.md`
