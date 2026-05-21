# cortex-langfuse — LLM observability stack

Self-hosted [Langfuse](https://langfuse.com) v3 with [ClickHouse](https://clickhouse.com)
and [MinIO](https://min.io) (internal blob store). Ingests OpenLLMetry traces
from every CortexOS service that imports `@cortexos/telemetry` (Node) or
`cortex_telemetry` (Python).

Postgres is reused from the core stack — Langfuse does **not** ship its own
Postgres container. ClickHouse and MinIO are internal-only compose services
(the Railway-only rule for external object storage is unaffected).

## Bring-up

1. Decrypt secrets:

   ```bash
   bash scripts/secrets-decrypt.sh langfuse
   # writes /opt/cortexos/.secrets/langfuse.env
   ```

2. Provision Postgres database/role (from the host Postgres):

   ```bash
   sudo -u postgres psql <<'SQL'
   CREATE ROLE langfuse LOGIN PASSWORD '<LANGFUSE_DB_PASSWORD>';
   CREATE DATABASE langfuse OWNER langfuse;
   SQL
   ```

3. Set `LANGFUSE_DATABASE_URL` in `/opt/cortexos/.secrets/langfuse.env`:

   ```text
   LANGFUSE_DATABASE_URL=postgresql://langfuse:<password>@host.docker.internal:5432/langfuse
   ```

4. Ensure the external network exists:

   ```bash
   docker network ls | grep cortex-net || docker network create cortex-net
   ```

5. Start the stack:

   ```bash
   cd /opt/cortexos/stacks/cortex-langfuse
   set -a; . /opt/cortexos/.secrets/langfuse.env; set +a
   docker compose up -d
   ```

6. Verify:

   ```bash
   curl -s http://127.0.0.1:3000/api/public/health | jq .
   ```

## First-admin bootstrap

Langfuse v3 supports headless org/project/user bootstrap via env vars
(`LANGFUSE_INIT_*`). Set in `/opt/cortexos/.secrets/langfuse.env`:

```text
LANGFUSE_INIT_ORG_ID=cortexos
LANGFUSE_INIT_ORG_NAME=CortexOS
LANGFUSE_INIT_PROJECT_ID=cortexos
LANGFUSE_INIT_PROJECT_NAME=cortexos
LANGFUSE_INIT_USER_EMAIL=admin@cortexos.local
LANGFUSE_INIT_USER_NAME=admin
LANGFUSE_INIT_USER_PASSWORD=<strong-password>
LANGFUSE_PUBLIC_KEY=pk-lf-<generated>
LANGFUSE_SECRET_KEY=sk-lf-<generated>
```

Generate keys with `openssl rand -hex 24` (apply the `pk-lf-` / `sk-lf-`
prefixes locally). On first `web` container boot the bootstrap runs once;
subsequent boots are no-ops.

## Project keys for services

`@cortexos/telemetry` and `cortex_telemetry` both read:

- `LANGFUSE_HOST` — defaults to `http://langfuse-web:3000` on `cortex-net`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`

Wire these into the consumer / bridge / graph env files; telemetry init is a
no-op when `LANGFUSE_HOST` is unset (safe for dev/test).

## Networks + volumes

- Network: `cortex-net` (external — created by `prompts/tools/11-docker.md`).
- Volumes: `clickhouse-data`, `clickhouse-logs`, `minio-data`.

## Related

- `prompts/tools/55-langfuse.md` — operator install + admin bootstrap.
- `docs/OBSERVABILITY-LLM.md` — instrumentation guide.
- `packages/cortex-telemetry/` — Node OpenLLMetry wrapper.
