# PostgreSQL (latest)

## Purpose

Install PostgreSQL from the official PGDG apt repository; create the `cortex_dashboard` database and `dashboard` role used by the CortexOS dashboard.

## Prerequisites

- `11-docker.md` completed (Docker not required for PG, but Docker must be present for later stacks).
- `10-os-hardening.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
if [ "$(pkg_family)" = "unknown" ]; then
    echo "WARNING: OS family not detected. Run prompts/os/00-os-selection.md first."
fi
```

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — port 5432 is free (no existing PG instance)
- [ ] Add PGDG apt repo and `pkg_install postgresql postgresql-contrib`
- [ ] `service_enable postgresql`
- [ ] `CREATE ROLE dashboard` + `CREATE DATABASE cortex_dashboard OWNER dashboard`
- [ ] Write `/opt/cortexos/.secrets/dashboard.env` (mode 0600) with `DATABASE_URL`
- [ ] Apply migrations `001_schema.sql` + `002_seed.sql`
- [ ] Confirm `psql ... -c "\dt"` lists `services` + `migrations` tables
- [ ] CHECKPOINT 2 confirmed — schema applied and `dashboard.env` is mode 600

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 5432` print no output (port 5432 free, no prior PostgreSQL instance)?

Type `confirmed` to proceed.

## Install

```bash
pkg_install curl gnupg lsb-release
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/postgresql.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | \
  sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt-get update -y -qq
pkg_install postgresql postgresql-contrib
service_enable postgresql
```

Verify package install:

```bash
dpkg -s postgresql >/dev/null
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
psql -U dashboard -h 127.0.0.1 cortex_dashboard < packages/dashboard/migrations/001_schema.sql
psql -U dashboard -h 127.0.0.1 cortex_dashboard < packages/dashboard/migrations/002_seed.sql
```

## Verify

```bash
psql -U dashboard -h 127.0.0.1 cortex_dashboard -c "\dt"
```

Expected: tables listed including `services`, `migrations`.

## CHECKPOINT 2

**STOP — operator question:** Does `psql -U dashboard -h 127.0.0.1 cortex_dashboard -c "\dt"` list `services` and `migrations` (not `Did not find any relations`)?

Type `confirmed` to proceed.

## CHECKPOINT 3

**STOP — operator question:** Does `stat -c "%a" /opt/cortexos/.secrets/dashboard.env` print `600` (not `644`)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/15-redis.md`
