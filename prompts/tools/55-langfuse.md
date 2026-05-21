# 55 — Langfuse

## Purpose

Deploy self-hosted Langfuse for LLM observability. Hermes, Paperclip adapter
runs, and dashboard AI routes may emit traces here.

## Prerequisites

- `11-docker.md`
- `14-postgresql.md`
- `40-hermes.md`

## Install

```bash
sudo -v
docker network ls | grep -q cortex-net || docker network create cortex-net
sudo install -d -m 0755 /opt/cortexos/stacks/cortex-langfuse
sudo cp -a stacks/cortex-langfuse/. /opt/cortexos/stacks/cortex-langfuse/

bash /opt/cortexos/scripts/secrets-decrypt.sh langfuse
sudo chmod 0600 /opt/cortexos/.secrets/langfuse.env

cd /opt/cortexos/stacks/cortex-langfuse
set -a; . /opt/cortexos/.secrets/langfuse.env; set +a
docker compose pull
docker compose up -d
```

## Configure Clients

Add the Langfuse project keys to services that emit model traces:

- `/opt/cortexos/.secrets/hermes/primary.env`
- `/opt/cortexos/.secrets/hermes/secondary.env`
- `/opt/cortexos/.secrets/paperclip.env`
- `/opt/cortexos/.secrets/dashboard.env`

Use the host-reachable URL for native services:

```bash
LANGFUSE_HOST=http://127.0.0.1:3001
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

Restart the services whose env files changed.

## Verify

```bash
curl -fsS http://127.0.0.1:3001/api/public/health
```

Open `https://${CORTEX_DOMAIN}:3001/` and confirm the `cortexos` project is
available.

## CHECKPOINT 1

Confirm Langfuse health returns 200 and Hermes/Paperclip trace env is present
where configured.

## Next

→ `prompts/tools/62-paperclip.md`
