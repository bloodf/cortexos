¶stacks/cortex-obot/README.md#C6F
1:# CortexOS Obot — MCP Gateway Platform
2:
3:Replaces `cortex-agentgateway` with [Obot](https://obot.ai/) for centralized MCP server
4:management, discovery, authentication, and audit.
5:
6:## Architecture
7:
8:- **Image**: `ghcr.io/obot-platform/obot:latest`
9:- **Port**: `127.0.0.1:8090` → container `8080` (Tailscale Serve on `:8090`; no Caddy subpath)
10:- **Database**: CortexOS PostgreSQL with pgvector extension
11:- **Runtime**: Docker socket mount for MCP server container management
12:
13:## Prerequisites
14:
15:1. PostgreSQL running with pgvector extension:
16:   ```sql
17:   CREATE EXTENSION IF NOT EXISTS vector;
18:   ```
19:2. Database and user for Obot:
20:   ```sql
21:   CREATE USER obot WITH PASSWORD '<password>';
22:   CREATE DATABASE obot OWNER obot;
23:   \c obot
24:   CREATE EXTENSION IF NOT EXISTS vector;
25:   ```
26:3. Env file at `/opt/cortexos/.secrets/obot.env`
27:
28:## Deployment
29:
30:```bash
31:docker compose up -d
32:```
33:
34:Access via Tailscale Serve (direct port): `https://cortexos.<tailnet>.ts.net:8090/`

See `docs/rebuild/network-access-and-remaining-work.md` for the operator network model.
35: