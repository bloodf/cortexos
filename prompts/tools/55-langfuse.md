# 55 — Langfuse

## Purpose

Deploy self-hosted Langfuse for LLM observability. Dashboard, Hermes profiles, and sandbox runner emit traces through `@cortexos/telemetry` when `LANGFUSE_*` env is present.

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

Create shared host-service client env:

```bash
sudo tee /opt/cortexos/.secrets/langfuse-client.env >/dev/null <<'EOF'
LANGFUSE_HOST=http://localhost:3001
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
EOF
sudo chmod 0600 /opt/cortexos/.secrets/langfuse-client.env
```

Load it from native systemd services:

- `cortex-dashboard.service` → `EnvironmentFile=-/opt/cortexos/.secrets/langfuse-client.env`
- `hermes-profile@.service` → `EnvironmentFile=-/opt/cortexos/.secrets/langfuse-client.env`

Sandbox runner is on `cortex-net`; use internal Langfuse URL in `/opt/cortexos/.secrets/sandbox.env`:

```bash
LANGFUSE_HOST=http://cortex-langfuse-web:3000
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

Services requiring restart after client env changes:

```bash
sudo systemctl daemon-reload
sudo systemctl restart cortex-dashboard hermes-profile@cortex hermes-profile@external-profile hermes-profile@operator-host
cd /opt/cortexos/stacks/cortex-sandbox-runner && docker compose up -d --force-recreate cortex-sandbox-runner
```

## Verify

```bash
curl -fsS http://localhost:3001/api/public/health
curl -fsS -u "$LANGFUSE_PUBLIC_KEY:$LANGFUSE_SECRET_KEY" http://localhost:3001/api/public/traces
```

Open `https://${CORTEX_DOMAIN}:3001/` and confirm dashboard/Hermes/sandbox traces appear after traffic.

## Next

→ `prompts/tools/62-paperclip.md`
