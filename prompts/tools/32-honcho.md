# Honcho (latest)

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

## Purpose

Install self-hosted Honcho as the only CortexOS memory backend. Paperclip and
Hermes are the only agent orchestration path.

Honcho exposes a REST API, not a web UI. `/` may return 404; use `/health`, `/docs` if enabled, and dashboard integration for operator workflows.

## Prerequisites

- `11-docker.md` completed.
- `31-9router.md` completed and exposes the configured Hermes chat models.
- Vulkan Ollama is active on `127.0.0.1:11435` with
  `nomic-embed-text:latest` installed.
- legacy agent import material has been preserved under
  `/opt/cortexos/backups/memory-import-pending/` if it exists.

## Ports and paths

| Item | Value |
| --- | --- |
| Honcho API | `127.0.0.1:18690` |
| Stack | `/opt/cortexos/stacks/honcho` |
| Data | `/opt/cortexos/data/honcho` |
| Secrets | `/opt/cortexos/.secrets/honcho.env` |

## Install

```bash
sudo install -d -m 0755 /opt/cortexos/stacks /opt/cortexos/data/honcho
sudo chown -R "$USER:$USER" /opt/cortexos/stacks /opt/cortexos/data/honcho

rm -rf /opt/cortexos/stacks/honcho
git clone https://github.com/plastic-labs/honcho /opt/cortexos/stacks/honcho
cd /opt/cortexos/stacks/honcho
```

Write `/opt/cortexos/.secrets/honcho.env` from the upstream self-hosting
variables. Honcho must call 9Router for model work through the Docker bridge
proxy. Honcho uses split providers: Vulkan Ollama for local embeddings and
9Router for tool-calling reasoning features.

```bash
set -a
source /opt/cortexos/.secrets/9router.env
set +a

HONCHO_AUTH_SECRET="$(openssl rand -hex 32)"
HONCHO_ENCRYPTION_KEY="$(openssl rand -hex 32)"

sudo tee /opt/cortexos/.secrets/honcho.env >/dev/null <<EOF
APP_BASE_URL=http://127.0.0.1:18690
AUTH_SECRET=${HONCHO_AUTH_SECRET}
ENCRYPTION_KEY=${HONCHO_ENCRYPTION_KEY}
HONCHO_HOST=127.0.0.1
HONCHO_PORT=18690
LLM_OPENAI_API_KEY=${NINEROUTER_API_KEY}
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
EMBEDDING_MODEL_CONFIG__OVERRIDES__BASE_URL=http://172.30.0.1:11435/v1
EMBEDDING_VECTOR_DIMENSIONS=768
DERIVER_ENABLED=true
DERIVER_WORKERS=3
DERIVER_POLLING_SLEEP_INTERVAL_SECONDS=0.5
HONCHO_DATA_DIR=/opt/cortexos/data/honcho
EOF
sudo chmod 600 /opt/cortexos/.secrets/honcho.env
```

Honcho containers cannot reach host loopback directly. Install the narrow
Docker-network proxy for Vulkan Ollama embeddings:

```bash
sudo install -m 0644 templates/systemd/ollama-honcho-embeddings-proxy.service \
  /etc/systemd/system/ollama-honcho-embeddings-proxy.service
sudo systemctl daemon-reload
sudo systemctl enable --now ollama-honcho-embeddings-proxy.service
```

Start the upstream self-hosted stack from
`https://honcho.dev/docs/v3/contributing/self-hosting` after mapping its API
service to `127.0.0.1:18690`. Keep Honcho data under
`/opt/cortexos/data/honcho`.

After first migration, align pgvector dimensions to Ollama's 768-dimensional
embedding output:

```bash
cd /opt/cortexos/stacks/honcho
docker compose run --rm --entrypoint /app/.venv/bin/python api \
  scripts/configure_embeddings.py --yes
```

Run Honcho with message embeddings and the deriver enabled. The deriver,
summary, dialectic, and dream model configs must all point at 9Router so no
Honcho text-generation path falls back to the upstream OpenAI defaults:

```bash
docker compose up -d --scale deriver=1
```

Record the effective compose override in `/opt/cortexos/stacks/honcho` so the
dashboard can inspect it later.

## Verify

```bash
set -a
source /opt/cortexos/.secrets/9router.env
set +a

curl -fsS -H "Authorization: Bearer ${NINEROUTER_API_KEY}" \
  "${NINEROUTER_BASE_URL%/}/v1/models" | jq -e '.data[].id | select(.=="cx/gpt-5.5")'

curl -fsS http://127.0.0.1:18690/health
# Honcho is API-only: `/` returning 404 is not a failure.

cd /opt/cortexos/stacks/honcho
docker compose exec -T api /app/.venv/bin/python - <<'PY'
import json, os, urllib.request
req = urllib.request.Request(
  "http://172.17.0.1:11434/v1/chat/completions",
  data=json.dumps({"model":"cx/gpt-5.5","messages":[{"role":"user","content":"Return ok."}],"max_tokens":20}).encode(),
  headers={"content-type":"application/json","authorization":f"Bearer {os.environ['LLM_OPENAI_API_KEY']}"},
)
data = json.loads(urllib.request.urlopen(req, timeout=45).read())
assert data["choices"][0]["message"]["content"]
PY

curl -fsS http://127.0.0.1:11435/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text:latest","input":"honcho smoke"}' |
  jq -e '.data[0].embedding | length == 768'

cd /opt/cortexos/stacks/honcho
docker compose exec -T api /app/.venv/bin/python - <<'PY'
import json, urllib.request
req = urllib.request.Request(
  "http://172.30.0.1:11435/v1/embeddings",
  data=json.dumps({"model":"nomic-embed-text:latest","input":"honcho docker smoke"}).encode(),
  headers={"content-type":"application/json"},
)
data = json.loads(urllib.request.urlopen(req, timeout=20).read())
assert len(data["data"][0]["embedding"]) == 768
PY
```

Also create the initial workspaces:

```bash
curl -fsS -X POST http://127.0.0.1:18690/v3/workspaces \
  -H "Authorization: Bearer ${HONCHO_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"id":"primary"}'
curl -fsS -X POST http://127.0.0.1:18690/v3/workspaces \
  -H "Authorization: Bearer ${HONCHO_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"id":"secondary"}'
```

## Next

→ `prompts/tools/40-hermes.md`
