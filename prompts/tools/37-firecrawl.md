# 37 - FireCrawl (self-hosted)

## Purpose

Deploy a local, API-compatible [FireCrawl](https://github.com/firecrawl/firecrawl) instance so CortexOS tools and agents can call `http://127.0.0.1:3002` instead of the FireCrawl cloud API.

What is included:

- FireCrawl API + worker (`firecrawl-api`)
- Playwright browser-rendering service (`firecrawl-playwright`)
- Dedicated Redis, PostgreSQL, and RabbitMQ containers

What is **not** included (self-hosted limitations):

- Fire-engine anti-bot/IP-rotation features
- `/agent` and `/browser` cloud-only endpoints

## Resource warning

FireCrawl is resource-hungry. Do not install this on a host below the minimum.

| Tier | RAM | CPU | Notes |
| --- | --- | --- | --- |
| Minimum | 8 GB | 4 cores | Tight; expect swapping under load |
| Recommended | 12+ GB | 4+ cores | Comfortable for routine crawls |

## Ports and paths

| Item | Value |
| --- | --- |
| FireCrawl API | `127.0.0.1:3002` |
| Tailnet path | `https://<tailnet-host>/firecrawl/` (after Caddy snippet) |
| Bull queue UI | `https://<tailnet-host>/firecrawl/admin/<BULL_AUTH_KEY>/queues` |
| Stack | `/opt/cortexos/stacks/firecrawl` |
| Secrets | `/opt/cortexos/.secrets/firecrawl.env` |

## Prerequisites

- `11-docker.md` completed.
- `13-caddy.md` completed (for tailnet path-based access).
- At least 8 GB free RAM on the host.

## Input Gate

**STOP — input question:** Provide the following before proceeding.

| Field | Default | Notes |
| --- | --- | --- |
| AI extraction backend | `none` | `none` disables `/extract`; `openai` for cloud; `ollama` for local Ollama. |
| Expose on tailnet? | `yes` | Adds the `/firecrawl` path to Caddy. |

```bash
read -p "AI extraction backend (none/openai/ollama) [none]: " AI_BACKEND
AI_BACKEND="${AI_BACKEND:-none}"
read -p "Expose FireCrawl on the tailnet via Caddy? (yes/no) [yes]: " EXPOSE_TAILNET
EXPOSE_TAILNET="${EXPOSE_TAILNET:-yes}"

if [ "${AI_BACKEND}" = "openai" ]; then
  read -s -p "OpenAI API key: " OPENAI_API_KEY; echo
fi

if [ "${AI_BACKEND}" = "ollama" ]; then
  read -p "Ollama base URL [http://host.docker.internal:11434/api]: " OLLAMA_BASE_URL
  OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://host.docker.internal:11434/api}"
  read -p "Ollama model name [qwen3:32b]: " MODEL_NAME
  MODEL_NAME="${MODEL_NAME:-qwen3:32b}"
fi

export AI_BACKEND EXPOSE_TAILNET OPENAI_API_KEY OLLAMA_BASE_URL MODEL_NAME
echo "AI backend: ${AI_BACKEND}, tailnet: ${EXPOSE_TAILNET}"
```

## Todo

- [ ] CHECKPOINT 1 confirmed — host has ≥8 GB free RAM and port 3002 is free
- [ ] Write `/opt/cortexos/.secrets/firecrawl.env` with generated and operator-provided values
- [ ] Deploy the FireCrawl stack
- [ ] CHECKPOINT 2 confirmed — `/health` and a scrape smoke test succeed
- [ ] (Optional) Add the Caddy `/firecrawl` path and reload Caddy
- [ ] Register FireCrawl in the dashboard catalog
- [ ] CHECKPOINT 3 confirmed — dashboard catalog and tailnet path are correct

## CHECKPOINT 1

**STOP — operator question:** Does this host have at least 8 GB free RAM and is port 3002 unused?

```bash
free -h
ss -tlnp | grep 3002 && echo "PORT IN USE" || echo "port 3002 free"
```

Expected: `free` shows ≥8 GB total (or available swap + RAM ≥8 GB if you accept the minimum), and `ss` prints `port 3002 free`.

Type `confirmed` to proceed.

## Configure secrets

Generate credentials and write the runtime env file. Secrets never leave this file.

```bash
sudo install -d -m 0700 /opt/cortexos/.secrets

BULL_AUTH_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
RABBITMQ_PASSWORD=$(openssl rand -hex 24)
REDIS_PASSWORD=$(openssl rand -hex 24)

AI_EXTRACT_OPENAI_API_KEY=""
AI_EXTRACT_OPENAI_BASE_URL=""
AI_EXTRACT_MODEL_NAME=""
AI_EXTRACT_MODEL_EMBEDDING_NAME=""
AI_EXTRACT_OLLAMA_BASE_URL=""

case "${AI_BACKEND}" in
  openai)
    AI_EXTRACT_OPENAI_API_KEY="${OPENAI_API_KEY}"
    AI_EXTRACT_MODEL_NAME="gpt-5.5"
    AI_EXTRACT_MODEL_EMBEDDING_NAME="text-embedding-3-small"
    ;;
  ollama)
    AI_EXTRACT_OLLAMA_BASE_URL="${OLLAMA_BASE_URL}"
    AI_EXTRACT_MODEL_NAME="${MODEL_NAME}"
    ;;
esac

sudo tee /opt/cortexos/.secrets/firecrawl.env >/dev/null <<EOF
# Required
PORT=3002
HOST=0.0.0.0
INTERNAL_PORT=3002
USE_DB_AUTHENTICATION=false
LOGGING_LEVEL=info

# Passwords — generated at install time
BULL_AUTH_KEY=${BULL_AUTH_KEY}
POSTGRES_DB=firecrawl
POSTGRES_USER=firecrawl
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
RABBITMQ_USER=firecrawl
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}

# Connection URLs (internal Docker network)
# Redis URLs use explicit `default` username — ioredis requires this with Redis 6+ ACLs.
REDIS_URL=redis://default:${REDIS_PASSWORD}@redis:6379
REDIS_RATE_LIMIT_URL=redis://default:${REDIS_PASSWORD}@redis:6379
PLAYWRIGHT_MICROSERVICE_URL=http://playwright-service:3000/scrape
NUQ_RABBITMQ_URL=amqp://firecrawl:${RABBITMQ_PASSWORD}@rabbitmq:5672
NUQ_DATABASE_URL=postgresql://firecrawl:${POSTGRES_PASSWORD}@nuq-postgres:5432/firecrawl

# RabbitMQ image expects DEFAULT_* names for boot-time user creation
RABBITMQ_DEFAULT_USER=firecrawl
RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASSWORD}

# Boolean flags — must be explicit true/false, never empty
BLOCK_MEDIA=false
ALLOW_LOCAL_WEBHOOKS=false

# Optional AI extraction / structured output
OPENAI_API_KEY=${AI_EXTRACT_OPENAI_API_KEY}
OPENAI_BASE_URL=${AI_EXTRACT_OPENAI_BASE_URL}
MODEL_NAME=${AI_EXTRACT_MODEL_NAME}
MODEL_EMBEDDING_NAME=${AI_EXTRACT_MODEL_EMBEDDING_NAME}
OLLAMA_BASE_URL=${AI_EXTRACT_OLLAMA_BASE_URL}
EOF

sudo chmod 600 /opt/cortexos/.secrets/firecrawl.env
# Docker Compose must read this file as the operator user.
sudo chown "$(id -u):$(id -g)" /opt/cortexos/.secrets/firecrawl.env
echo "Wrote /opt/cortexos/.secrets/firecrawl.env"
```

## Install stack

```bash
cd /opt/cortexos/stacks/firecrawl
docker compose pull
docker compose up -d --remove-orphans
```

First pull/download may take several minutes (Playwright image is large). First startup may take 30–60 seconds while the API initializes its database.

## Verify

The self-hosted API does not expose a dedicated `/health` endpoint; use the root path and a scrape smoke test.

```bash
# API root (should return {"message":"Firecrawl API",...})
sleep 10
curl -fsS http://127.0.0.1:3002/ | python3 -m json.tool

# Basic scrape smoke test
curl -fsS -X POST http://127.0.0.1:3002/v2/scrape \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","formats":["markdown"]}' \
  | python3 -m json.tool | head -c 600
```

Expected:

- `GET /` returns HTTP 200 with JSON containing `"message":"Firecrawl API"`.
- `/v2/scrape` returns a JSON response with `data.markdown` containing text from example.com.

If the health check fails, inspect logs:

```bash
cd /opt/cortexos/stacks/firecrawl
docker compose logs -f --tail 100 api
```

## CHECKPOINT 2

**STOP — operator question:** Did `GET /` return the FireCrawl API message and did the example.com scrape return markdown content?

Type `confirmed` to proceed.

## Expose on tailnet (optional)

Skip this section if `EXPOSE_TAILNET=no`.

Add the following snippet **inside** your existing Caddy site block (the one that already proxies the dashboard), before the catch-all dashboard route:

```caddy
@firecrawl path /firecrawl /firecrawl/*
handle @firecrawl {
    uri strip_prefix /firecrawl
    reverse_proxy 127.0.0.1:3002 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

Then reload Caddy:

```bash
sudo systemctl reload caddy
```

Verify the tailnet path:

```bash
# Replace with your tailnet FQDN
curl -fsS https://<tailnet-host>/firecrawl/health | python3 -m json.tool
```

The Bull queue admin UI is reachable at:

```text
https://<tailnet-host>/firecrawl/admin/<BULL_AUTH_KEY>/queues
```

Retrieve `BULL_AUTH_KEY` from `/opt/cortexos/.secrets/firecrawl.env` if needed.

## Dashboard registration

Register FireCrawl in the dashboard service catalog and refresh dynamic seeding:

```bash
cd /opt/cortexos/packages/dashboard-next
DB_PASSWORD=$(grep -oP 'postgresql://dashboard:\K[^@]+' /opt/cortexos/.secrets/dashboard.env) \
  node scripts/migrate-cli.js
node ../../scripts/dynamic-seed.js
```

Then set the public tailnet URL once (replace with your tailnet host):

```bash
psql -U dashboard -h 127.0.0.1 cortex_dashboard \
  -c "SELECT cortex_set_service_urls('https://<tailnet-host>');"
```

Verify the catalog row:

```bash
psql -U dashboard -h 127.0.0.1 cortex_dashboard \
  -c "SELECT slug, is_active, open_url FROM services WHERE slug = 'firecrawl';"
```

Expected: `firecrawl` is `is_active = t` with `open_url = https://<tailnet-host>/firecrawl` (or `#` if not exposed on tailnet).

## CHECKPOINT 3

**STOP — operator question:** Is the dashboard catalog row correct, and is the tailnet health path (if enabled) returning 200?

Type `confirmed` to proceed.

## Client wiring

Point any FireCrawl SDK or OpenAI-compatible client at:

```text
Base URL: http://127.0.0.1:3002/v2   (host-local)
Base URL: https://<tailnet-host>/firecrawl/v2   (tailnet)
```

No API key is required for local self-hosted mode (`USE_DB_AUTHENTICATION=false`).

## Rollback

```bash
cd /opt/cortexos/stacks/firecrawl
docker compose down
# To remove data as well:
# docker compose down -v
```

If you added the Caddy `/firecrawl` block, remove it and `sudo systemctl reload caddy`.

## Next

→ `prompts/tools/47a-cortex-sandbox.md` (if installing the sandbox runner).
