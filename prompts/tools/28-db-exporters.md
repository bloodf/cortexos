# 28 - Database Exporters

## Purpose

Add Prometheus exporters for PostgreSQL, Redis, and MongoDB to the monitoring stack. Live containers: `cortex-pg-exporter`, `cortex-redis-exporter`, `cortex-mongo-exporter`.

> **Note:** `snmp-exporter` and `adguard-exporter` are also part of the monitoring compose stack and are scraped by Prometheus. They are defined in `stacks/monitoring/docker-compose.yml` — do not duplicate them here.

## Prerequisites

- `20-prometheus.md` completed.
- `14-postgresql.md` completed — PostgreSQL running on `127.0.0.1:5432`.
- `15-redis.md` completed — Redis running.
- `16-mongodb.md` completed — MongoDB running (optional; mongo exporter is skipped if MongoDB is not installed).

## Ports

| Exporter | Container | Host port |
| --- | --- | --- |
| pg-exporter | `cortex-pg-exporter` | 9187 |
| redis-exporter | `cortex-redis-exporter` | 9121 |
| mongo-exporter | `cortex-mongo-exporter` | 9216 |

## Todo

- [ ] CHECKPOINT 1 confirmed — exporter ports free, required databases healthy
- [ ] Write `/opt/cortexos/.secrets/db-exporters.env` mode 0600
- [ ] Copy `stacks/monitoring/docker-compose.yml` (includes exporter services)
- [ ] `docker compose up -d --remove-orphans cortex-pg-exporter cortex-redis-exporter`
- [ ] If MongoDB is installed: `docker compose up -d --remove-orphans cortex-mongo-exporter`
- [ ] CHECKPOINT 2 confirmed — all deployed exporters respond on their metrics endpoints

## CHECKPOINT 1

**STOP — operator question:** Are the required exporter ports free, and are PostgreSQL and Redis healthy? (MongoDB is only checked if it was installed.)

```bash
ss -tlnp | grep -E '9187|9121'
pg_isready -h 127.0.0.1 -p 5432
docker ps --filter name=cortex-redis --format '{{.Names}} {{.Status}}'
# Only if MongoDB was installed:
# docker ps --filter name=cortex-mongo --format '{{.Names}} {{.Status}}'
```

Type `confirmed` to proceed.

## Configure secrets

**STOP — operator action required:** Provide the following connection credentials for the exporters.

- `PG_EXPORTER_DSN` — PostgreSQL DSN for the exporter user (read-only recommended; default: `postgresql://dashboard:{PG_PASSWORD}@127.0.0.1:5432/cortex_dashboard?sslmode=disable`)
- `REDIS_EXPORTER_ADDR` — Redis address (default: `redis://127.0.0.1:6379`)
- `MONGO_EXPORTER_URI` — MongoDB URI (default: `mongodb://admin:{MONGO_ROOT_PASSWORD}@127.0.0.1:27017`)

```bash
sudo install -d -m 0700 /opt/cortexos/.secrets
sudo tee /opt/cortexos/.secrets/db-exporters.env >/dev/null <<EOF
PG_EXPORTER_DSN={PG_EXPORTER_DSN}
REDIS_EXPORTER_ADDR={REDIS_EXPORTER_ADDR}
EOF
# Only add MongoDB exporter config if MongoDB is installed
if docker ps --filter name=cortex-mongo --format '{{.Names}}' | grep -q .; then
    echo "MONGO_EXPORTER_URI={MONGO_EXPORTER_URI}" | sudo tee -a /opt/cortexos/.secrets/db-exporters.env >/dev/null
fi
sudo chmod 600 /opt/cortexos/.secrets/db-exporters.env
```

Confirm mode 600:

```bash
stat -c "%a" /opt/cortexos/.secrets/db-exporters.env
```

## Install

```bash
sudo install -d -m 0755 /opt/cortexos/stacks/monitoring
sudo cp -a stacks/monitoring/. /opt/cortexos/stacks/monitoring/
cd /opt/cortexos/stacks/monitoring
docker compose --env-file /opt/cortexos/.secrets/db-exporters.env \
  up -d --remove-orphans \
  cortex-pg-exporter cortex-redis-exporter
# Only start mongo exporter if MongoDB is installed
if docker ps --filter name=cortex-mongo --format '{{.Names}}' | grep -q .; then
    docker compose --env-file /opt/cortexos/.secrets/db-exporters.env \
      up -d --remove-orphans cortex-mongo-exporter
fi
```

## Verify

```bash
curl -fsS http://127.0.0.1:9187/metrics | grep -m1 pg_up
curl -fsS http://127.0.0.1:9121/metrics | grep -m1 redis_up
# Only verify mongo exporter if MongoDB is installed
if docker ps --filter name=cortex-mongo --format '{{.Names}}' | grep -q .; then
    curl -fsS http://127.0.0.1:9216/metrics | grep -m1 mongodb_up
fi
```

Expected: each deployed exporter returns a `*_up 1` metric.

Confirm Prometheus scrapes them:

```bash
curl -fsS "http://127.0.0.1:9090/api/v1/targets" \
  | jq -r '.data.activeTargets[] | select(.labels.job | test("pg|redis|mongo")) | "\(.labels.job): \(.health)"'
```

## CHECKPOINT 2

**STOP — operator question:** Do all deployed exporters respond with `*_up 1`, and does the Prometheus targets endpoint show them as `up`?

Type `confirmed` to proceed.

## Rollback

```bash
cd /opt/cortexos/stacks/monitoring
docker compose stop cortex-pg-exporter cortex-redis-exporter
docker compose rm -f cortex-pg-exporter cortex-redis-exporter
# Only stop mongo exporter if it was started
if docker ps --filter name=cortex-mongo --format '{{.Names}}' | grep -q .; then
    docker compose stop cortex-mongo-exporter
    docker compose rm -f cortex-mongo-exporter
fi
```

## Next

→ Configure an OpenAI-compatible chat endpoint for agent model calls.
