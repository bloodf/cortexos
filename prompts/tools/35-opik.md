# Opik (latest)

## DEPRECATED — superseded by Langfuse v2 (`35a-langfuse.md`)

> The upstream Opik backend hardcodes a **MySQL** JDBC connection, which
> violates the CortexOS "PostgreSQL only" rule. Live Phase H validation
> on 2026-05-16 chose Langfuse v2 instead (Postgres-backed; v3 was
> rejected because it requires ClickHouse + Redis + S3, the last of
> which violates the operator "no R2 / no foreign object stores" rule).
> Follow `prompts/tools/35a-langfuse.md` for new installs.
>
> This spoke is retained for archive reference and for sites that
> already run Opik; do NOT enable it on a fresh CortexOS install.

## Purpose
Deploy the Opik LLM observability platform (by Comet ML) to trace, evaluate, and monitor AI agent calls flowing through 9Router and OpenClaw.

## Prerequisites
- `14-postgresql.md` completed.
- `11-docker.md` completed.

## CHECKPOINT 1
Operator: confirm ports 5173 (Opik UI) and 5000 (Opik API) are free. Type "confirmed" to proceed.

## Install

```bash
git clone https://github.com/comet-ml/opik /opt/cortexos/stacks/opik
cd /opt/cortexos/stacks/opik
```

Snapshot upstream docs:
```bash
curl -fsSL https://raw.githubusercontent.com/comet-ml/opik/HEAD/README.md \
  > docs/external/opik.snapshot.md
sed -i '1s/^/<!-- Snapshot of upstream opik at probe time. NOT a version pin. Operator reinstalls latest upstream on each fresh install. -->\n/' \
  docs/external/opik.snapshot.md
```

Run Opik via its official Docker Compose (check `deployment/docker-compose/` in the repo):

```bash
cd /opt/cortexos/stacks/opik
# Use the official compose file from upstream HEAD
docker compose -f deployment/docker-compose/docker-compose.yml up -d
```

## Configure

Point 9Router to export traces to Opik by setting in `/opt/cortexos/.secrets/9router.env`:

```bash
echo "OPIK_API_BASE=http://localhost:5000" | sudo tee -a /opt/cortexos/.secrets/9router.env
sudo systemctl restart 9router
```

## Verify

```bash
curl -s http://localhost:5000/api/v1/health
```

Expected: health OK response.

Access UI: `http://localhost:5173` (or via Caddy proxy at `opik.{DOMAIN}`).

## CHECKPOINT 2
Operator: confirm Opik API health returns OK and the UI is accessible. Type "confirmed" to proceed.

## Next
→ `prompts/tools/40-openclaw.md`
