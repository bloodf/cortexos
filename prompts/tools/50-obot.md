# 50 - Obot (MCP Gateway)

Obot is the CortexOS MCP (Model Context Protocol) gateway platform. It replaces
the previous custom agentgateway with a full-featured MCP server hosting,
discovery, authentication, and audit solution.

Source:

- `stacks/cortex-obot/docker-compose.yml`
- Config: `/opt/cortexos/.secrets/obot.env`

## Interactive Setup

This prompt asks the operator for configuration values. No env vars are assumed.

### 1. PostgreSQL Database

Obot requires PostgreSQL 17+ with the pgvector extension. CortexOS runs
PostgreSQL — we add a dedicated database and user.

Ask the operator:

- **obot DB password**: generate or accept a random one
- Confirm the PostgreSQL host and port (default: the docker network or
  `127.0.0.1:5432`)

Create the database and user:

```bash
docker exec -i cortex-postgres psql -U postgres <<'SQL'
CREATE USER obot WITH PASSWORD '<password>';
CREATE DATABASE obot OWNER obot;
\c obot
CREATE EXTENSION IF NOT EXISTS vector;
SQL
```

### 2. Obot Environment File

Write `/opt/cortexos/.secrets/obot.env`:

```env
OBOT_SERVER_DSN=postgres://obot:<password>@<pg-host>:5432/obot
OPENAI_API_KEY=<key-from-operator>
OBOT_SERVER_HOSTNAME=<hostname>:<port>
OBOT_SERVER_ENABLE_AUTHENTICATION=true
OBOT_BOOTSTRAP_TOKEN=<generate-random>
```

Ask the operator:

- **OpenAI API key** (or other LLM provider key)
- **Bootstrap token** (generate if not provided)

### 3. Deploy

```bash
cd /opt/cortexos/stacks/cortex-obot
docker compose up -d
```

### 4. Tailscale Serve (no Caddy)
Expose Obot on the tailnet port directly:
```bash
sudo tailscale serve --bg --https=8090 http://127.0.0.1:8090
```
Access: `https://<tailnet-host>:8090/`
### 5. Verify
```bash
curl -fsS http://127.0.0.1:8090/api/
docker logs cortex-obot 2>&1 | tail -20
```
### 6. Bootstrap
Access `https://<tailnet-host>:8090/` and complete first-run setup with the
bootstrap token.

### 7. Migrate MCP Tools

Re-create the agentgateway allowlist as MCP servers in Obot:

- service.status → MCP tool
- service.health → MCP tool
- project.list → MCP tool
- etc.

Use Obot's web UI or API to register MCP servers and configure tool visibility.

### 8. Remove Old AgentGateway (if present)

After Obot is verified, remove the legacy agentgateway only if it exists:

```bash
if systemctl list-unit-files | grep -q cortex-agentgateway; then
    systemctl stop cortex-agentgateway
    systemctl disable cortex-agentgateway
    rm -f /etc/systemd/system/cortex-agentgateway.service
    systemctl daemon-reload
fi
```

Remove any legacy agentgateway systemd unit or Caddy routes if still present.

## Notes

- The dashboard's `agent_gateway_audit` table is **kept** — it's used by the
  dashboard's own audit logging (15+ files). The audit module stays. Obot has
  its own separate audit/MCP audit log system.
- Obot needs Docker socket access to deploy MCP server containers.
- The `OBOT_SERVER_DSN` must point to a PG instance reachable from the
  container network (use docker network hostname or host IP).
