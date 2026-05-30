# 28 - Database Exporters

## Purpose

Add Prometheus exporters for PostgreSQL, Redis, and MongoDB to the monitoring stack. Live containers: `cortex-pg-exporter`, `cortex-redis-exporter`, `cortex-mongo-exporter`.

> **Note:** `snmp-exporter` and `adguard-exporter` are also part of the monitoring compose stack and are scraped by Prometheus. They are defined in `stacks/monitoring/docker-compose.yml` — do not duplicate them here.

## Prerequisites

- `20-prometheus.md` completed.
- `14-postgresql.md` completed — PostgreSQL running on `127.0.0.1:5432`.
- `15-redis.md` completed — Redis running.
- `16-mongodb.md` completed — MongoDB running.

## Ports

| Exporter | Container | Host port |
| --- | --- | --- |
| pg-exporter | `cortex-pg-exporter` | 9187 |
| redis-exporter | `cortex-redis-exporter` | 9121 |
| mongo-exporter | `cortex-mongo-exporter` | 9216 |

## Todo

- [ ] CHECKPOINT 1 confirmed — exporter ports free, all three databases healthy
- [ ] Write `/opt/cortexos/.secrets/db-exporters.env` mode 0600
- [ ] Copy `stacks/monitoring/docker-compose.yml` (includes exporter services)
- [ ] `docker compose up -d --remove-orphans cortex-pg-exporter cortex-redis-exporter cortex-mongo-exporter`
- [ ] CHECKPOINT 2 confirmed — all three exporters respond on their metrics endpoints

## CHECKPOINT 1

**STOP — operator question:** Are ports 9187, 9121, and 9216 free, and are PostgreSQL, Redis, and MongoDB all healthy?

```bash
ss -tlnp | grep -E '9187|9121|9216'
pg_isready -h 127.0.0.1 -p 5432
docker ps --filter name=cortex-redis --format '{{.Names}} {{.Status}}'
docker ps --filter name=cortex-mongo  --format '{{.Names}} {{.Status}}'
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
MONGO_EXPORTER_URI={MONGO_EXPORTER_URI}
EOF
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
  cortex-pg-exporter cortex-redis-exporter cortex-mongo-exporter
```

## Verify

```bash
curl -fsS http://127.0.0.1:9187/metrics | grep -m1 pg_up
curl -fsS http://127.0.0.1:9121/metrics | grep -m1 redis_up
curl -fsS http://127.0.0.1:9216/metrics | grep -m1 mongodb_up
```

Expected: each exporter returns a `*_up 1` metric.

Confirm Prometheus scrapes them:

```bash
curl -fsS "http://127.0.0.1:9090/api/v1/targets" \
  | jq -r '.data.activeTargets[] | select(.labels.job | test("pg|redis|mongo")) | "\(.labels.job): \(.health)"'
```

## CHECKPOINT 2

**STOP — operator question:** Do all three exporters respond with `*_up 1`, and does the Prometheus targets endpoint show them as `up`?

Type `confirmed` to proceed.

## Rollback

```bash
cd /opt/cortexos/stacks/monitoring
docker compose stop cortex-pg-exporter cortex-redis-exporter cortex-mongo-exporter
docker compose rm -f cortex-pg-exporter cortex-redis-exporter cortex-mongo-exporter
```

## Next

→ `prompts/tools/31-9router.md`
