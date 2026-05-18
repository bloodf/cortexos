# Langfuse v2 (latest)

## Purpose

Deploy Langfuse v2 as the CortexOS LLM observability platform: traces,
prompt versioning, eval scores, and dashboards over every 9Router /
OpenClaw call. Supersedes `35-opik.md` (Opik backend hardcodes MySQL —
violates the PostgreSQL-only rule).

## Why v2, not v3

- Langfuse v3 requires **ClickHouse + Redis + S3** as hard dependencies.
- S3 conflicts with the operator "no R2 / no foreign object stores" rule.
- ClickHouse adds a second OLAP datastore not present elsewhere in the
  CortexOS topology.
- Langfuse v2 stores everything in **PostgreSQL**, which is already
  provisioned via `14-postgresql.md`. Live Phase H validation
  on 2026-05-16 selected v2 for this reason.

## Prerequisites

- `14-postgresql.md` completed (Langfuse will use the existing
  `cortex-postgresql` container — see `docs/POSTGRES-LAYOUT.md`).
- `11-docker.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## CHECKPOINT 1

Operator: confirm ports 3000 (Langfuse UI) and `cortex-postgresql` is
reachable on the internal docker network. Type "confirmed" to proceed.

## Install

```bash
mkdir -p /opt/cortexos/stacks/langfuse
cd /opt/cortexos/stacks/langfuse

tee docker-compose.yml <<'EOF'
services:
  langfuse:
    image: langfuse/langfuse:2
    restart: unless-stopped
    depends_on:
      - cortex-postgresql
    environment:
      DATABASE_URL: postgresql://langfuse:${LANGFUSE_DB_PASSWORD}@cortex-postgresql:5432/langfuse
      NEXTAUTH_SECRET: ${LANGFUSE_NEXTAUTH_SECRET}
      SALT: ${LANGFUSE_SALT}
      NEXTAUTH_URL: http://127.0.0.1:3000
      TELEMETRY_ENABLED: "false"
    ports:
      - "127.0.0.1:3000:3000"
    networks:
      - cortex-internal

networks:
  cortex-internal:
    external: true
EOF
```

## Configure

Provision DB and secrets:

```bash
docker exec -it cortex-postgresql psql -U postgres <<SQL
CREATE USER langfuse WITH PASSWORD '<generated>';
CREATE DATABASE langfuse OWNER langfuse;
SQL

sudo tee /opt/cortexos/.secrets/langfuse.env <<EOF
LANGFUSE_DB_PASSWORD=<same as above>
LANGFUSE_NEXTAUTH_SECRET=$(openssl rand -hex 32)
LANGFUSE_SALT=$(openssl rand -hex 16)
EOF
sudo chmod 600 /opt/cortexos/.secrets/langfuse.env
```

Boot:

```bash
docker compose --env-file /opt/cortexos/.secrets/langfuse.env up -d
```

Point 9Router at Langfuse OTLP exporter:

```bash
echo "LANGFUSE_BASE=http://127.0.0.1:3000" | sudo tee -a /opt/cortexos/.secrets/9router.env
echo "LANGFUSE_PUBLIC_KEY=<from UI>"        | sudo tee -a /opt/cortexos/.secrets/9router.env
echo "LANGFUSE_SECRET_KEY=<from UI>"        | sudo tee -a /opt/cortexos/.secrets/9router.env
sudo systemctl restart 9router
```

## Verify

```bash
curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/public/health
```

Expected: `200`.

## CHECKPOINT 2

Operator: confirm Langfuse UI loads at `http://127.0.0.1:3000`, the
`/api/public/health` endpoint returns `200`, and 9Router shows
`LANGFUSE_*` env vars on restart. Type "confirmed" to proceed.

## Next

→ `prompts/tools/40-openclaw.md`
