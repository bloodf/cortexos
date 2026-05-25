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

**STOP — input question:** What is the 9Router API key for this machine?

Wait for the operator's answer. In the commands below, replace
`{NINEROUTER_API_KEY}` with that answer.

**STOP — input question:** What is the 9Router OpenAI-compatible base URL from
the host? Use `http://127.0.0.1:11434/v1` unless this machine was configured
with a different 9Router listener.

Wait for the operator's answer. In the commands below, replace
`{NINEROUTER_BASE_URL}` with that answer.

```bash
sudo install -d -m 0755 /opt/cortexos/stacks /opt/cortexos/data/honcho
sudo chown -R "$USER:$USER" /opt/cortexos/stacks /opt/cortexos/data/honcho

rm -rf /opt/cortexos/stacks/honcho
git clone https://github.com/plastic-labs/honcho /opt/cortexos/stacks/honcho
cd /opt/cortexos/stacks/honcho
```

Install the CortexOS-owned compose file. Do not use `--scale`: every
long-running Honcho service has an explicit `container_name`, so Docker cannot
create `honcho-deriver-2` or any other numbered duplicate during reinstall.

```bash
install -m 0644 /opt/cortexos/templates/honcho/docker-compose.yml docker-compose.yml
```

Write `/opt/cortexos/.secrets/honcho.env` from the upstream self-hosting
variables. Honcho must call 9Router for model work through the Docker bridge
proxy. Honcho uses split providers: Vulkan Ollama for local embeddings and
9Router for tool-calling reasoning features.

```bash
sudo install -d -m 0700 /opt/cortexos/.secrets
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
EMBEDDING_MODEL_CONFIG__OVERRIDES__BASE_URL=http://172.30.0.1:11435/v1
EMBEDDING_VECTOR_DIMENSIONS=768
DERIVER_ENABLED=true
DERIVER_WORKERS=3
DERIVER_POLLING_SLEEP_INTERVAL_SECONDS=0.5
HONCHO_DATA_DIR=/opt/cortexos/data/honcho
EOF
sudo chmod 600 /opt/cortexos/.secrets/honcho.env
```

The host verification commands use `{NINEROUTER_BASE_URL}` from the input
question. Containers use `http://172.17.0.1:11434/v1`, which is the Docker
bridge path to the same 9Router service.

Honcho containers cannot reach host loopback directly. Install the narrow
Docker-network proxy for Vulkan Ollama embeddings:

```bash
sudo install -m 0644 /opt/cortexos/templates/systemd/ollama-honcho-embeddings-proxy.service \
  /etc/systemd/system/ollama-honcho-embeddings-proxy.service
sudo systemctl daemon-reload
sudo systemctl enable --now ollama-honcho-embeddings-proxy.service
```

Remove stale numbered Honcho containers from earlier installs, then start the
stack. `--remove-orphans` is mandatory for reinstall safety.

```bash
cd /opt/cortexos/stacks/honcho
docker ps -a \
  --filter label=com.docker.compose.project=honcho \
  --format '{{.ID}} {{.Label "com.docker.compose.container-number"}}' |
  awk '$2 != "" && $2 != "1" {print $1}' |
  xargs -r docker rm -f

docker compose up -d --build --remove-orphans
```

After the stack starts, align pgvector dimensions to Ollama's 768-dimensional
embedding output:

```bash
cd /opt/cortexos/stacks/honcho
docker exec -i honcho-api /app/.venv/bin/python scripts/configure_embeddings.py --yes
```

Confirm no numbered Honcho duplicate remains:

```bash
docker ps -a --format '{{.Names}} {{.Label "com.docker.compose.project"}} {{.Label "com.docker.compose.container-number"}}' |
  awk '$2 == "honcho" && $1 ~ /-[0-9]+$/ {bad=1; print} END {exit bad ? 1 : 0}'
```

## Verify

```bash
curl -fsS -H "Authorization: Bearer {NINEROUTER_API_KEY}" \
  "{NINEROUTER_BASE_URL}/models" | jq -e '.data[].id | select(.=="cx/gpt-5.5")'

curl -fsS http://127.0.0.1:18690/health
# Honcho is API-only: `/` returning 404 is not a failure.

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

curl -fsS http://127.0.0.1:11435/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text:latest","input":"honcho smoke"}' |
  jq -e '.data[0].embedding | length == 768'

cd /opt/cortexos/stacks/honcho
docker exec -i honcho-api /app/.venv/bin/python - <<'PY'
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

**STOP — input question:** Does this Honcho install require an API bearer token?
If yes, provide it. If no, answer `none`.

Wait for the operator's answer. In the commands below, use the `none` branch
for an unauthenticated local install, or replace `{HONCHO_API_KEY}` with the
token they provided.

```bash
# For an unauthenticated local install:
HONCHO_AUTH_ARGS=()

# For an authenticated install:
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

## Next

→ `prompts/tools/40-hermes.md`
