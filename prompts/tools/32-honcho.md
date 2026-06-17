# 32 - Honcho

## Purpose

Install self-hosted Honcho as the CortexOS memory backend. Live containers: `honcho-api`, `honcho-database`, `honcho-deriver`, `honcho-redis`.

Honcho exposes a REST API, not a web UI. `/` may return 404; use `/health` and `/docs` (if enabled) for operator verification.

## Prerequisites

- `11-docker.md` completed.
- `31-9router.md` completed and 9Router is serving chat models.
- Vulkan Ollama active on `127.0.0.1:11435` with `nomic-embed-text:latest` installed.

## Ports and paths

| Item | Value |
| --- | --- |
| Honcho API | `127.0.0.1:18690` |
| Stack | `/opt/cortexos/stacks/honcho` |
| Data | `/opt/cortexos/data/honcho` |
| Secrets | `/opt/cortexos/.secrets/honcho.env` |

## CHECKPOINT 1

**STOP — operator question:** Is `nomic-embed-text:latest` installed in Ollama on port 11435?

```bash
curl -fsS http://127.0.0.1:11435/v1/models | jq -r '.data[].id' | grep nomic-embed-text
```

Expected: `nomic-embed-text:latest` appears in the list.

Type `confirmed` to proceed.

## Configure secrets

**STOP — operator action required:** Provide the following values.

1. What is the 9Router API key for this machine?
2. What is the 9Router OpenAI-compatible base URL from the host? (default: `http://127.0.0.1:11434/v1`)

Wait for the operator's answers. Replace `{NINEROUTER_API_KEY}` and `{NINEROUTER_BASE_URL}` in the commands below.

```bash
sudo install -d -m 0700 /opt/cortexos/.secrets
sudo install -d -m 0755 /opt/cortexos/data/honcho

HONCHO_AUTH_SECRET="$(openssl rand -hex 32)"
HONCHO_ENCRYPTION_KEY="$(openssl rand -hex 32)"

sudo tee /opt/cortexos/.secrets/honcho.env >/dev/null <<EOF
APP_BASE_URL=http://127.0.0.1:18690
AUTH_SECRET=${HONCHO_AUTH_SECRET}
ENCRYPTION_KEY=${HONCHO_ENCRYPTION_KEY}
HONCHO_HOST=127.0.0.1
HONCHO_PORT=18690
LLM_OPENAI_API_KEY={NINEROUTER_API_KEY}
DERIVER_MODEL_CONFIG__TRANSPORT=openai
DERIVER_MODEL_CONFIG__MODEL=cx/gpt-5.5
DERIVER_MODEL_CONFIG__OVERRIDES__BASE_URL=http://172.17.0.1:11434/v1
SUMMARY_ENABLED=true
SUMMARY_MODEL_CONFIG__TRANSPORT=openai
SUMMARY_MODEL_CONFIG__MODEL=cx/gpt-5.5
SUMMARY_MODEL_CONFIG__OVERRIDES__BASE_URL=http://172.17.0.1:11434/v1
DIALECTIC_LEVELS__minimal__MODEL_CONFIG__TRANSPORT=openai
DIALECTIC_LEVELS__minimal__MODEL_CONFIG__MODEL=cx/gpt-5.5
DIALECTIC_LEVELS__minimal__MODEL_CONFIG__OVERRIDES__BASE_URL=http://172.17.0.1:11434/v1
DIALECTIC_LEVELS__low__MODEL_CONFIG__TRANSPORT=openai
DIALECTIC_LEVELS__low__MODEL_CONFIG__MODEL=cx/gpt-5.5
DIALECTIC_LEVELS__low__MODEL_CONFIG__OVERRIDES__BASE_URL=http://172.17.0.1:11434/v1
DIALECTIC_LEVELS__medium__MODEL_CONFIG__TRANSPORT=openai
DIALECTIC_LEVELS__medium__MODEL_CONFIG__MODEL=cx/gpt-5.5
DIALECTIC_LEVELS__medium__MODEL_CONFIG__OVERRIDES__BASE_URL=http://172.17.0.1:11434/v1
DIALECTIC_LEVELS__high__MODEL_CONFIG__TRANSPORT=openai
DIALECTIC_LEVELS__high__MODEL_CONFIG__MODEL=cx/gpt-5.5
DIALECTIC_LEVELS__high__MODEL_CONFIG__OVERRIDES__BASE_URL=http://172.17.0.1:11434/v1
DIALECTIC_LEVELS__max__MODEL_CONFIG__TRANSPORT=openai
DIALECTIC_LEVELS__max__MODEL_CONFIG__MODEL=cx/gpt-5.5
DIALECTIC_LEVELS__max__MODEL_CONFIG__OVERRIDES__BASE_URL=http://172.17.0.1:11434/v1
DREAM_ENABLED=true
DREAM_DEDUCTION_MODEL_CONFIG__TRANSPORT=openai
DREAM_DEDUCTION_MODEL_CONFIG__MODEL=cx/gpt-5.5
DREAM_DEDUCTION_MODEL_CONFIG__OVERRIDES__BASE_URL=http://172.17.0.1:11434/v1
DREAM_INDUCTION_MODEL_CONFIG__TRANSPORT=openai
DREAM_INDUCTION_MODEL_CONFIG__MODEL=cx/gpt-5.5
DREAM_INDUCTION_MODEL_CONFIG__OVERRIDES__BASE_URL=http://172.17.0.1:11434/v1
EMBED_MESSAGES=true
EMBEDDING_MODEL_CONFIG__TRANSPORT=openai
EMBEDDING_MODEL_CONFIG__MODEL=nomic-embed-text:latest
EMBEDDING_MODEL_CONFIG__OVERRIDES__BASE_URL=http://127.0.0.1:11435/v1
EMBEDDING_VECTOR_DIMENSIONS=768
DERIVER_ENABLED=true
DERIVER_WORKERS=3
DERIVER_POLLING_SLEEP_INTERVAL_SECONDS=0.5
HONCHO_DATA_DIR=/opt/cortexos/data/honcho
EOF
sudo chmod 600 /opt/cortexos/.secrets/honcho.env
```

> Containers reach 9Router via Docker bridge `http://172.17.0.1:11434/v1`. The host-side URL (`{NINEROUTER_BASE_URL}`) is used only in verify commands run from the host shell.

## Install embeddings proxy

Honcho containers cannot reach host loopback directly. Install the narrow Docker-network proxy for Vulkan Ollama embeddings:

```bash
sudo install -m 0644 /opt/cortexos/templates/systemd/ollama-honcho-embeddings-proxy.service \
  /etc/systemd/system/ollama-honcho-embeddings-proxy.service
sudo systemctl daemon-reload
sudo systemctl enable --now ollama-honcho-embeddings-proxy.service
```

## Install stack

```bash
sudo install -d -m 0755 /opt/cortexos/stacks
rm -rf /opt/cortexos/stacks/honcho
git clone https://github.com/plastic-labs/honcho /opt/cortexos/stacks/honcho
cd /opt/cortexos/stacks/honcho
install -m 0644 /opt/cortexos/templates/honcho/docker-compose.yml docker-compose.yml
```

Remove any stale numbered containers from earlier installs, then start:

```bash
docker ps -a \
  --filter label=com.docker.compose.project=honcho \
  --format '{{.ID}} {{.Label "com.docker.compose.container-number"}}' |
  awk '$2 != "" && $2 != "1" {print $1}' |
  xargs -r docker rm -f

docker compose up -d --build --remove-orphans
```

Align pgvector dimensions:

```bash
docker exec -i honcho-api /app/.venv/bin/python scripts/configure_embeddings.py --yes
```

Confirm no numbered duplicate containers remain:

```bash
docker ps -a --format '{{.Names}} {{.Label "com.docker.compose.project"}} {{.Label "com.docker.compose.container-number"}}' |
  awk '$2 == "honcho" && $1 ~ /-[0-9]+$/ {bad=1; print} END {exit bad ? 1 : 0}'
```

## Verify

```bash
# 9Router reachable from host
curl -fsS -H "Authorization: Bearer {NINEROUTER_API_KEY}" \
  "{NINEROUTER_BASE_URL}/models" | jq -e '.data[].id | select(.=="cx/gpt-5.5")'

# Honcho health
curl -fsS http://127.0.0.1:18690/health
# /health returning 200 is success; / returning 404 is not a failure.

# 9Router reachable from inside honcho-api container
cd /opt/cortexos/stacks/honcho
docker exec -i honcho-api /app/.venv/bin/python - <<'PY'
import json, os, urllib.request
req = urllib.request.Request(
  "http://172.17.0.1:11434/v1/chat/completions",
  data=json.dumps({"model":"cx/gpt-5.5","messages":[{"role":"user","content":"Return ok."}],"max_tokens":20}).encode(),
  headers={"content-type":"application/json","authorization":f"Bearer {os.environ['LLM_OPENAI_API_KEY']}"},
)
data = json.loads(urllib.request.urlopen(req, timeout=45).read())
assert data["choices"][0]["message"]["content"]
PY

# Vulkan Ollama embeddings reachable from host
curl -fsS http://127.0.0.1:11435/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text:latest","input":"honcho smoke"}' |
  jq -e '.data[0].embedding | length == 768'

# Vulkan Ollama embeddings reachable from inside honcho-api container
docker exec -i honcho-api /app/.venv/bin/python - <<'PY'
import json, urllib.request
req = urllib.request.Request(
  "http://127.0.0.1:11435/v1/embeddings",
  data=json.dumps({"model":"nomic-embed-text:latest","input":"honcho docker smoke"}).encode(),
  headers={"content-type":"application/json"},
)
data = json.loads(urllib.request.urlopen(req, timeout=20).read())
assert len(data["data"][0]["embedding"]) == 768
PY
```

## Create initial workspaces

**STOP — operator question:** Does this Honcho install require an API bearer token? If yes, provide it. If no, answer `none`.

Wait for the operator's answer.

```bash
# For an unauthenticated local install:
HONCHO_AUTH_ARGS=()
# For an authenticated install, replace {HONCHO_API_KEY}:
# HONCHO_AUTH_ARGS=(-H "Authorization: Bearer {HONCHO_API_KEY}")

curl -fsS -X POST http://127.0.0.1:18690/v3/workspaces \
  "${HONCHO_AUTH_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d '{"id":"primary"}'
curl -fsS -X POST http://127.0.0.1:18690/v3/workspaces \
  "${HONCHO_AUTH_ARGS[@]}" \
  -H "Content-Type: application/json" \
  -d '{"id":"secondary"}'
```

## CHECKPOINT 2

**STOP — operator question:** Does `curl -fsS http://127.0.0.1:18690/health` return 200?

Type `confirmed` to proceed.

## Expose on tailnet

Honcho binds loopback; publish the API (and MCP worker) over the tailnet via
`tailscale serve` so other hosts can reach them with TLS:

```bash
# Honcho API (also serves Swagger at /docs)
sudo tailscale serve --bg --https 18690 http://127.0.0.1:18690
# Honcho MCP worker (effective port from the 10-port.conf drop-in is 18694)
sudo tailscale serve --bg --https 18694 http://127.0.0.1:18694
```

Reach from another tailnet machine:
`https://<tailnet-host>:18690/health` (API) ·
`https://<tailnet-host>:18690/docs` (Swagger) ·
`https://<tailnet-host>:18694/` (MCP — expects auth, returns 401 unauthenticated).

## Dashboard registration

The catalog rows, correct health probes, and visibility flags ship as
dashboard migration `017_honcho_probe_fix.sql` (honcho / honcho-mcp / proxy),
applied automatically at dashboard startup. The flags are set explicitly in
the migration rather than left to `scripts/dynamic-seed.js` — that script is
host-only and its startup invocation was dropped in the SvelteKit cutover, so
migrations are the authoritative mechanism. No manual SQL needed.

The public Apps URL (Swagger `/docs`) is **not** hardcoded — it is assigned
per-install by `cortex_set_service_urls(base_url)` (migration `019`), where
`base_url` is your own tailnet host passed at runtime:

```bash
# once, with this host's base URL (e.g. from `tailscale status`):
SELECT cortex_set_service_urls('https://<your-tailnet-host>');
```

## Rollback

```bash
cd /opt/cortexos/stacks/honcho
docker compose down
sudo systemctl disable --now ollama-honcho-embeddings-proxy.service
sudo rm /etc/systemd/system/ollama-honcho-embeddings-proxy.service
sudo systemctl daemon-reload
sudo tailscale serve --https=18690 off
sudo tailscale serve --https=18694 off
```

## Next

Per `prompts/tools/_order.md` — after Honcho, run
`prompts/tools/47a-cortex-sandbox.md` (AI gateway) and
`prompts/tools/50-obot.md` (MCP gateway platform). The per-
profile `hermes-honcho` wiring prompt is in the Planned table
of `docs/APPS.md` and is not yet shipped.
