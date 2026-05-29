# CortexOS Obot — MCP Gateway Platform

Replaces `cortex-agentgateway` with [Obot](https://obot.ai/) for centralized MCP server
management, discovery, authentication, and audit.

## Architecture

- **Image**: `ghcr.io/obot-platform/obot:latest`
- **Port**: `127.0.0.1:8090` → container `8080` (Caddy-proxied via `/obot/`)
- **Database**: CortexOS PostgreSQL with pgvector extension
- **Runtime**: Docker socket mount for MCP server container management

## Prerequisites

1. PostgreSQL running with pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
2. Database and user for Obot:
   ```sql
   CREATE USER obot WITH PASSWORD '<password>';
   CREATE DATABASE obot OWNER obot;
   \c obot
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Env file at `/opt/cortexos/.secrets/obot.env`

## Deployment

```bash
docker compose up -d
```

Access via Caddy: `https://cortexos.<tailnet>.ts.net/obot/`
