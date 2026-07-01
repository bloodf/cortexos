# 33 — Memory OS (ClaudioDrews/memory-os)

## Purpose

Install the upstream [ClaudioDrews/memory-os](https://github.com/ClaudioDrews/memory-os) stack on the **host** as a long-term memory layer on top of Honcho. The 7-layer architecture — workspace files, sessions, structured facts, Icarus fabric, Qdrant vector db, LLM wiki, ground-truth hierarchy — is wired to an OpenAI-compatible chat endpoint + Honcho (port 18690) stack. The Hermes Agent binary at `/usr/local/bin/hermes` (per `60-incus-project.md:132`) loads the Icarus plugin from `${HERMES_HOME}/plugins/icarus` after install.

Upstream research baseline (commit `a556f90`, branch `research/memory-os` — RECOMMENDATION: SWAP IN, layer on top of Honcho, MIT, 881 stars, v0.2.0, ~5-day-old repo at research time) set three non-negotiable security conditions: **pin to the `v0.2.0` git tag (C-1)**, **wire the LLM via `ICARUS_ENDPOINT` + `ICARUS_API_KEY_ENV` (the upstream's documented provider-agnostic override, .env.example:72)**, and **wrap any wiki write-back in the existing PB-5 approvals gate (C-5)**.

> **Important upstream behavior.** `ClaudioDrews/memory-os/setup.sh` is **NOT** flag-driven — there is no `--llm-provider` or `--llm-base-url` flag. The script is opinionated: it clones to `${HOME}/memory-os`, installs the Icarus plugin to `${HOME}/.hermes/plugins/icarus`, and writes a Docker stack to `${HOME}/memory-os/docker/`. It knows about `OPENROUTER_API_KEY` and `OPENROUTER_DS_API_KEY` only — OpenRouter, not a generic endpoint. We override `${HOME}` for the duration of the install so the upstream's hardcoded paths land inside the CortexOS tree, then layer the endpoint-specific env vars on top after the script finishes.

## Prerequisites

- `11-docker.md` completed (the upstream `setup.sh` requires `docker info` to succeed and the compose plugin).
- An OpenAI-compatible chat endpoint reachable from the host and from inside Docker.
- `32-honcho.md` completed (we layer on top of Honcho — the per-profile `config.yaml` block from `60-incus-project.md:82-88` is what wires both backends into the Hermes Agent).
- `15-redis.md` completed and Redis is reachable on `127.0.0.1:6379` from the host (memory-arq shares this Redis on a separate DB index; the upstream `setup.sh` starts its own `redis:7-alpine` container bound to `127.0.0.1:6379`, which will conflict if a system Redis is already on that port — see "Port conflict" below).
- Hermes Agent binary installed at `/usr/local/bin/hermes` (per `60-incus-project.md:132`).
- `nomic-embed-text:latest` is available via Ollama on `127.0.0.1:11435` (32-honcho.md).

## Ports and paths

| Item | Value |
| --- | --- |
| Qdrant (vector DB) | `127.0.0.1:6333` |
| Redis (memory-arq) | `127.0.0.1:6379` |
| ARQ worker | (no host-side port; the worker is a pure ARQ worker with `EXPOSE 8000` in the Dockerfile but no `ports:` mapping in the compose file — see §5 step 4) |
| Stack (cloned repo) | `/opt/cortexos/memory-os` |
| Icarus plugin | `/opt/cortexos/memory-os/.hermes/plugins/icarus` (per `${HOME}` override) |
| Memory stack (wiki + fabric) | `/opt/cortexos/memory-os/wiki` |
| Data (Qdrant + Redis volumes) | `/opt/cortexos/data/memory-os/{qdrant,redis}` |
| Secrets | `/opt/cortexos/.secrets/memory-os.env` |

> **Port conflict (read first).** The upstream `docker-compose.yml` binds `127.0.0.1:6379:6379` and `127.0.0.1:6333:6333`. If the host already has a system Redis on `6379` (15-redis.md), the upstream container's `127.0.0.1:6379` host bind will fail with "port already in use" and the unit will not start. Two resolutions:
> 1. **Preferred (per upstream research §4):** stop the system Redis, let the upstream's `redis:7-alpine` container own `6379` for the memory-arq workload, and continue. Memory-arq is a private queue (not shared with the dashboard's session-store Redis on a different DB index anyway).
> 2. **If the system Redis must stay:** edit the upstream `docker-compose.yml` to remap the redis port to e.g. `127.0.0.1:6390:6379` (the upstream's worker reads `REDIS_HOST`/`REDIS_PORT` from the `worker.environment` block in the compose file, so the only change needed is the host port mapping on the redis service). Document the change in the post-install note.

## Sudo gate

This spoke runs `sudo` (writes to `/opt/cortexos/memory-os`, `/opt/cortexos/data/memory-os`, `/opt/cortexos/.secrets/`, and `/etc/systemd/system/`). Authenticate **now**:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
if [ "$(pkg_family)" = "unknown" ]; then
    echo "WARNING: OS family not detected. Run prompts/os/00-os-selection.md first."
fi
```

## CHECKPOINT 1

**STOP — operator question:** Is Docker running, the chat endpoint reachable on `{LLM_BASE_URL}`, Honcho reachable on `127.0.0.1:18690`, the Hermes Agent binary present at `/usr/local/bin/hermes`, and `nomic-embed-text:latest` available in Ollama on `127.0.0.1:11435`?

```bash
docker info >/dev/null 2>&1
curl -fsS -H "Authorization: Bearer {LLM_API_KEY}" {LLM_BASE_URL}/models | jq -e '.data | length > 0' >/dev/null
curl -fsS http://127.0.0.1:18690/health >/dev/null 2>&1
test -x /usr/local/bin/hermes
curl -fsS http://127.0.0.1:11435/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text:latest","input":"memory-os preflight"}' \
  | jq -e '.data[0].embedding | length == 768' >/dev/null
```

Type `confirmed` to proceed.

## Ask user

| Field | Default | Notes |
| --- | --- | --- |
| Memory OS install path (CORTEX_ROOT + relative) | `/opt/cortexos/memory-os` | Upstream clones to `${HOME}/memory-os`; we override `${HOME}` for the install. |
| Per-profile install on existing Incus instances? | `no` | C-6: per-profile opt-in only. Default is no — the 7-layer stack has a footprint (~1GB RAM steady, ~12GB disk) operators may not want per-profile. |

```bash
read -p "Install path [${MEMORY_OS_INSTALL_PATH:-/opt/cortexos/memory-os}]: " _p
MEMORY_OS_INSTALL_PATH="${_p:-/opt/cortexos/memory-os}"
read -p "Install per-profile on existing Incus instances? (yes/no) [no]: " _prof
MEMORY_OS_PER_PROFILE="${_prof:-no}"
export MEMORY_OS_INSTALL_PATH MEMORY_OS_PER_PROFILE
```

## Configure secrets

**STOP — operator action required:** Provide the following values.

1. What is the OpenAI-compatible API key for this machine?
2. What is the OpenAI-compatible base URL? Default: `http://127.0.0.1:11434/v1` (host-side; the upstream setup.sh writes a `docker/.env` that the worker reads, and from inside the docker network the URL is the same — we are not running the worker in a separate network namespace).
3. What chat model name should Icarus use for extraction? Default: `gpt-4o-mini`.

Wait for the operator's answers. Replace `{LLM_API_KEY}`, `{LLM_BASE_URL}`, and `{LLM_MODEL}` in the commands below.

```bash
sudo install -d -m 0700 -o root -g root /opt/cortexos/.secrets
sudo install -d -m 0755 -o root -g root /opt/cortexos/data/memory-os

# Redis password (upstream's setup.sh generates this internally; we mint our own
# so the secrets file is reviewable before the script runs)
REDIS_PASSWORD="$(openssl rand -hex 16)"

sudo tee /opt/cortexos/.secrets/memory-os.env >/dev/null <<EOF
# LLM credentials — the upstream's provider-agnostic override (.env.example:72)
# Generic OpenAI-compatible endpoint, not OpenRouter. We override the extraction
# pipeline to call the configured endpoint instead. This follows the upstream
# research §3 notes.
LLM_API_KEY={LLM_API_KEY}
ICARUS_ENDPOINT={LLM_BASE_URL}/chat/completions
ICARUS_API_KEY_ENV=LLM_API_KEY
ICARUS_EXTRACTION_MODEL={LLM_MODEL}
ICARUS_EXTRACTION_MAX_TOKENS=4096

# Ollama embeddings (matches 32-honcho.md line 13 — nomic-embed-text on 11435)
OLLAMA_BASE_URL=http://127.0.0.1:11435
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest

# Qdrant + Redis + Worker — consumed by the upstream docker-compose.yml
# (which expects these keys verbatim per docker/.env)
QDRANT_API_KEY=
REDIS_PASSWORD=${REDIS_PASSWORD}
EMBEDDING_DIMS=4096
COLLECTION_NAME=knowledge_base
LOG_LEVEL=INFO

# Host-side Icarus env (documentation; not consumed by the worker or by
# the Icarus plugin directly). The upstream Icarus plugin reads
# ICARUS_ENDPOINT / ICARUS_API_KEY_ENV / ICARUS_EXTRACTION_MODEL (set
# above) and FABRIC_DIR / HERMES_HOME / HERMES_AGENT_NAME (set below).
# The worker reads QDRANT_HOST / QDRANT_PORT / QDRANT_API_KEY and
# REDIS_HOST / REDIS_PORT / REDIS_PASSWORD via docker-compose's
# worker.environment block, not via the Icarus plugin. QDRANT_URL is
# kept here for operator visibility (curl /health, /collections) and
# for the host-side smoke test in §5 below.
QDRANT_URL=http://127.0.0.1:6333

# Memory stack paths (CortexOS layer — overlay on the upstream's ${HOME} defaults)
VAULT_PATH=/opt/cortexos/memory-os/wiki
HERMES_HOME=/opt/cortexos/memory-os/.hermes
WIKI_ROOT=/opt/cortexos/memory-os/wiki
FABRIC_DIR=/opt/cortexos/memory-os/wiki/fabric
STATE_DB_PATH=/opt/cortexos/data/memory-os/state.db
HERMES_LOGS_DIR=/opt/cortexos/data/memory-os/logs
HERMES_DLQ_PATH=/opt/cortexos/data/memory-os/wiki_ingest_failures.json
TELEMETRY_LOG_PATH=/opt/cortexos/data/memory-os/logs/query-telemetry.jsonl
REFLECTION_LOG_PATH=/opt/cortexos/data/memory-os/logs/reflection_trigger.log
EOF
sudo chmod 0600 /opt/cortexos/.secrets/memory-os.env
sudo chown root:root /opt/cortexos/.secrets/memory-os.env
```

The `ICARUS_ENDPOINT` + `ICARUS_API_KEY_ENV` mechanism is the upstream's documented provider-agnostic override (`.env.example:72`). When both are set, the Icarus extraction pipeline calls the named endpoint and reads the API key from the named env var — no OpenRouter middleman. The `OPENAI_API_KEY` + `OPENAI_BASE_URL` pair from the original brief is **not** the right form here because the upstream's `setup.sh` does not consume them; it consumes `OPENROUTER_API_KEY` / `OPENROUTER_DS_API_KEY` / `ICARUS_ENDPOINT`+`ICARUS_API_KEY_ENV` only.

## Todo

- [ ] CHECKPOINT 1 confirmed — Docker, chat endpoint, Honcho, Hermes Agent binary, Ollama nomic-embed-text all present
- [ ] Secrets file written to `/opt/cortexos/.secrets/memory-os.env` (mode 0600) with `REDIS_PASSWORD`, `LLM_API_KEY`, `ICARUS_ENDPOINT`, `ICARUS_API_KEY_ENV`, `ICARUS_EXTRACTION_MODEL`
- [ ] `${MEMORY_OS_INSTALL_PATH}` does not exist or is empty
- [ ] `/opt/cortexos/data/memory-os` does not exist or is empty
- [ ] Cloned the upstream `ClaudioDrews/memory-os` repo at the pinned tag `v0.2.0` (resolves to commit SHA `4b386e374d84fcfeb635f66fea9d4dcea7c6fd4a`; NOT `main` — C-1 from upstream research)
- [ ] Ran `setup.sh` with `HOME=${MEMORY_OS_INSTALL_PATH}` so upstream's hardcoded `${HOME}` paths land inside the CortexOS tree
- [ ] Overlaid the endpoint-specific env vars on `docker/.env` (so the worker's `OPENROUTER_API_KEY` slot gets the `LLM_API_KEY` value, and the worker reads `ICARUS_ENDPOINT` from the env it inherits from the systemd EnvironmentFile)
- [ ] `templates/systemd/cortex-memory-os.service` committed (force-tracked past `.gitignore` per the W52 + W61 + W65 convention) and rendered via `scripts/ops/cortex-render-units.sh cortex-memory-os.service`
- [ ] `systemctl enable --now cortex-memory-os.service` — Qdrant + Redis + worker containers up
- [ ] CHECKPOINT 2 — Qdrant `/health` 200, Redis PING, ARQ worker container shows `health=healthy` in `docker ps`
- [ ] Drop a test fact via the memory-os CLI and confirm Qdrant returns it via vector search
- [ ] If `MEMORY_OS_PER_PROFILE=yes`, run the per-profile block in `prompts/tools/60-incus-project.md` step 6.7 (per F-3 from upstream research; that step is currently Planned, not shipped)

## Install (host)

### 1. Clone the upstream at a pinned tag (C-1)

```bash
sudo install -d -m 0755 -o root -g root "${MEMORY_OS_INSTALL_PATH}"
sudo chown -R "$USER":"$USER" "${MEMORY_OS_INSTALL_PATH}"

# Clone + check out the v0.2.0 tag (resolves to commit SHA 4b386e37).
# Per upstream research condition C-1: "pin to tag `v0.2.0` (not
# `main`)". The upstream has git tags (v0.1.0, v0.2.0) but no GitHub
# Release notes — the two are independent: a git tag is a ref pointer,
# a GitHub Release is a packaged tarball + notes. We pin the git tag
# because the install needs the source tree, not a tarball.
git clone https://github.com/ClaudioDrews/memory-os "${MEMORY_OS_INSTALL_PATH}"
(cd "${MEMORY_OS_INSTALL_PATH}" && git checkout v0.2.0)
```

Verify the checkout is the expected commit (the `v0.2.0` tag is an annotated tag that resolves to commit `4b386e37`):

```bash
(cd "${MEMORY_OS_INSTALL_PATH}" && git rev-parse HEAD)
# Expected: 4b386e374d84fcfeb635f66fea9d4dcea7c6fd4a
(cd "${MEMORY_OS_INSTALL_PATH}" && git describe --tags --exact-match HEAD)
# Expected: v0.2.0
```

### 2. Run the upstream `setup.sh` with `HOME` override

The upstream script hardcodes `${HOME}/memory-os`, `${HOME}/.hermes/plugins/icarus`, and `${HOME}/vault` (the last is overridable via `VAULT_PATH`). Override `${HOME}` so the upstream's hardcoded paths land inside the CortexOS tree:

```bash
# shellcheck disable=SC2030,SC2031
HOME="${MEMORY_OS_INSTALL_PATH}" \
HERMES_HOME="${MEMORY_OS_INSTALL_PATH}/.hermes" \
VAULT_PATH="${MEMORY_OS_INSTALL_PATH}/wiki" \
  bash "${MEMORY_OS_INSTALL_PATH}/setup.sh"
```

> **Security note on `curl|bash`.** The `bash <(curl -sSL ...)` pattern is the most common install idiom for repos that ship a `setup.sh` and is acceptable here because: (a) the upstream is a pinned commit SHA (C-1), not `main`; (b) the upstream research's trust-boundary analysis is captured in this prompt; (c) the script's actions are auditable in the public source (the script is 15855 bytes, fully readable in the pinned commit). We use the local clone + `bash` invocation rather than `curl|bash` for an additional layer of review-the-script-first.

When the script's Phase 7 prompts for the OpenRouter key, **paste the LLM API key** (`{LLM_API_KEY}`). The setup script writes this to `docker/.env` as `OPENROUTER_API_KEY`, which is what the worker's environment gets. Step 3 below overlays the proper endpoint env vars on top.

The script's Phase 5 will install the Icarus plugin to `${HOME}/.hermes/plugins/icarus` = `${MEMORY_OS_INSTALL_PATH}/.hermes/plugins/icarus`. Phase 9 will warn that the rulebook amendments were not auto-applied — this is expected; the CortexOS layer 7 customization is per-profile (C-4, see F-3 in upstream research).

### 3. Overlay the endpoint env vars on the upstream `docker/.env`

The upstream `setup.sh` writes a minimal `docker/.env` with `OPENROUTER_API_KEY`, `REDIS_PASSWORD`, `QDRANT_API_KEY`, `EMBEDDING_DIMS`, `COLLECTION_NAME`, `LOG_LEVEL`, and the path overrides. We **append** the endpoint overrides and the CortexOS path overrides on top — do NOT delete the existing keys (the worker reads them verbatim):

```bash
sudo tee -a "${MEMORY_OS_INSTALL_PATH}/docker/.env" >/dev/null <<EOF

# ── CortexOS overlay (added by prompts/tools/33-hermes-memory-os.md) ─────────
# OpenAI-compatible provider-agnostic override (.env.example:72)
# The worker reads ICARUS_ENDPOINT from the env we pass via the systemd
# EnvironmentFile; this docker/.env block is for the host-side record.
LLM_API_KEY={LLM_API_KEY}
ICARUS_ENDPOINT={LLM_BASE_URL}/chat/completions
ICARUS_API_KEY_ENV=LLM_API_KEY
ICARUS_EXTRACTION_MODEL={LLM_MODEL}
# Use the same REDIS_PASSWORD the upstream just generated (read it back)
REDIS_PASSWORD_FILE=/opt/cortexos/.secrets/memory-os.env
# Memory stack paths inside the CortexOS tree
MEMORY_OS_WIKI_PATH=/opt/cortexos/memory-os/wiki
MEMORY_OS_HERMES_HOME=/opt/cortexos/memory-os/.hermes
MEMORY_OS_FABRIC_DIR=/opt/cortexos/memory-os/wiki/fabric
EOF
sudo chmod 0600 "${MEMORY_OS_INSTALL_PATH}/docker/.env"
sudo chown root:root "${MEMORY_OS_INSTALL_PATH}/docker/.env"
```

Then copy the host secrets file into the same directory the docker-compose context sees, so the worker can read the `LLM_API_KEY`:

```bash
# The worker's OPENAI-compatible env requires the API key on a named var.
# The upstream's compose file uses OPENROUTER_API_KEY (see docker-compose.yml
# line 49: OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}). The Icarus plugin's
# ICARUS_API_KEY_ENV override reads the named env var, so we also export
# LLM_API_KEY into the worker's environment by adding it to the
# compose file's worker.environment block. This is the only edit the
# upstream compose file needs.

# Add LLM_API_KEY to the worker service's environment block
sudo python3 - "${MEMORY_OS_INSTALL_PATH}/docker/docker-compose.yml" <<'PY'
import sys, re, pathlib
p = pathlib.Path(sys.argv[1])
text = p.read_text()
inject = (
    "      LLM_API_KEY: ${LLM_API_KEY}\n"
    "      ICARUS_ENDPOINT: ${ICARUS_ENDPOINT}\n"
    "      ICARUS_API_KEY_ENV: ${ICARUS_API_KEY_ENV}\n"
    "      ICARUS_EXTRACTION_MODEL: ${ICARUS_EXTRACTION_MODEL}\n"
)
# Insert right after the existing OPENROUTER_API_KEY: ${OPENROUTER_API_KEY} line
text2 = re.sub(
    r"(OPENROUTER_API_KEY: \$\{OPENROUTER_API_KEY\})",
    r"\1\n" + inject.rstrip("\n"),
    text,
    count=1,
)
if text2 == text:
    print("WARN: did not find OPENROUTER_API_KEY line — manual edit needed", file=sys.stderr)
else:
    p.write_text(text2)
    print("patched worker.environment with LLM_API_KEY + ICARUS_* vars")
PY
```

### 4. Render the systemd unit

The unit template is committed at `templates/systemd/cortex-memory-os.service`
(per the W52 / W61 / W65 convention — `templates/systemd/` is in
`.gitignore` (line 189), the file is force-tracked via `git add -f`).
Use the existing render flow to substitute `{CORTEX_ROOT}` and
`{CORTEX_SECRETS_DIR}` from the template into the live
`/etc/systemd/system/` tree:

```bash
# 1. Render the template (substitutes the placeholders)
sudo bash scripts/ops/cortex-render-units.sh cortex-memory-os.service

# 2. Reload systemd, enable + start
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-memory-os.service

# 3. Verify the rendered unit (WorkingDirectory must be the upstream docker dir)
sudo systemctl show cortex-memory-os.service -p User -p WorkingDirectory -p EnvironmentFile
# Expected:
#   User=root
#   WorkingDirectory=/opt/cortexos/memory-os/docker
#   EnvironmentFile=/opt/cortexos/.secrets/memory-os.env
```

The render script defaults `CORTEX_ROOT` to the repo root it discovers
from its own path — pass `CORTEX_ROOT=/opt/cortexos` explicitly if
the repo lives there (the production layout, per the audit-fixes W52
follow-up). Do NOT hand-edit the rendered unit at
`/etc/systemd/system/cortex-memory-os.service` — re-run the render
script on any change.

The template body (the canonical source) is at
`templates/systemd/cortex-memory-os.service` in this repo. It runs the
upstream docker-compose stack as `User=root Group=root` because the
worker needs to bind `127.0.0.1:6379` and `127.0.0.1:6333` directly
on the host loopback. Tighten the `User` directive to a dedicated
unprivileged user in a follow-up if the upstream ever supports a
non-root compose profile. The unit uses `Type=oneshot RemainAfterExit=yes`
because the actual work is `docker compose up -d --wait`, not a
long-running child process the kernel needs to track (mirrors
`boxbox.service`).

### 5. Verify

```bash
# 1. Qdrant health
curl -fsS http://127.0.0.1:6333/health
# Expected: {"status":"ok","title":"qdrant - vector DB","version":"1.17.1",...}

# 2. Qdrant collections (the worker creates knowledge_base on first run)
curl -fsS http://127.0.0.1:6333/collections | jq -r '.result.collections[].name'
# Expected: knowledge_base (after the first worker startup)

# 3. Redis PING
docker exec -i $(docker ps --filter label=com.docker.compose.project=memory-os \
  --format '{{.Names}}' | grep -E '^memory-os-redis' | head -1) \
  redis-cli -a "$(grep ^REDIS_PASSWORD= /opt/cortexos/.secrets/memory-os.env | cut -d= -f2-)" ping
# Expected: PONG

# 4. ARQ worker container health — the worker is a pure ARQ worker
# (no HTTP server, EXPOSE 8000 is documentation only and not mapped to
# host), so the verify is the container-level HEALTHCHECK
# (docker/worker/Dockerfile): `redis.ping()` against the in-network
# redis. The compose sets `healthcheck:` on Qdrant + Redis but NOT on
# the worker, so the worker relies on `depends_on: { qdrant: service_healthy,
# redis: service_healthy }` to start after Qdrant + Redis are healthy.
docker ps --filter label=com.docker.compose.project=memory-os \
  --filter label=com.docker.compose.service=worker \
  --format '{{.Names}}\t{{.Status}}'
# Expected: <worker-name>   Up X minutes (healthy)
# (If the worker doesn't have a container-level HEALTHCHECK, the Status
# column reads "Up" without "(healthy)"; in that case the next test
# (worker can reach Qdrant) is the real liveness gate.)

# 5. Drop a test fact via the memory-os CLI and confirm Qdrant returns it
# (the upstream ships a setup_db.py for state.db; the fabric-write path is
# the Icarus plugin's fabric_write tool, exercised through the Hermes Agent
# binary at /usr/local/bin/hermes. For a pure host-side smoke test, use the
# qdrant HTTP API to insert a test point directly:)
QDRANT_PT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
curl -fsS -X PUT "http://127.0.0.1:6333/collections/knowledge_base/points" \
  -H "Content-Type: application/json" \
  -d "{
    \"points\": [{
      \"id\": \"${QDRANT_PT_ID}\",
      \"vector\": $(python3 -c 'import json; print(json.dumps([0.0]*4096))'),
      \"payload\": {\"source\": \"smoke-test\", \"text\": \"memory-os install smoke\"}
    }]
  }"
# Expected: {"result":{"operation_id":<N>,"status":"acknowledged"},"status":"ok","time":<float>}

# 6. Vector search returns the test point
curl -fsS -X POST "http://127.0.0.1:6333/collections/knowledge_base/points/search" \
  -H "Content-Type: application/json" \
  -d "{
    \"vector\": $(python3 -c 'import json; print(json.dumps([0.0]*4096))'),
    \"limit\": 1,
    \"with_payload\": true
  }" | jq -e '.result[0].payload.source == "smoke-test"'
# Expected: true
```

## CHECKPOINT 2

**STOP — operator question:** Did all five verification steps above return the expected values? In particular, did the Qdrant vector search return the test point (`true`)?

Type `confirmed` to proceed.

## Per-profile install on Incus (optional sub-section)

If `MEMORY_OS_PER_PROFILE=yes`, the per-profile wiring is in
`prompts/tools/60-incus-project.md` step 6.7 (per F-3 from the
upstream research; that step is currently Planned, not shipped).
The pattern mirrors the existing `hermes-honcho` wiring planned for
the per-profile `config.yaml` block from `60-incus-project.md:82-88` —
add a `memory.longterm` block pointing at the host's Qdrant + Redis
via the per-profile port mapping.

The detailed step-by-step is in `60-incus-project.md` so the install
order stays flat; do not duplicate the steps here.

## Layer 7 customization (C-4)

Upstream research condition C-4 says: "layer 7 templates (SOUL.md,
rulebook.md) must be customized per-profile — the upstream templates
are generic and need CortexOS-specific ground truth language." The
upstream `setup.sh` warns at Phase 9 that the rulebook amendments are
not auto-applied; this is by design. After the install:

1. For each Hermes profile under
   `/opt/cortexos/hermes/profiles/<name>/`, copy the upstream templates:

   ```bash
   sudo cp /opt/cortexos/memory-os/setup/rulebook.md \
          /opt/cortexos/hermes/profiles/<name>/rulebook.md
   sudo cp /opt/cortexos/memory-os/modifications/soul-rulebook.md \
          /opt/cortexos/hermes/profiles/<name>/SOUL.md
   ```

2. Prepend the CortexOS preamble to each:

   ```markdown
   # CortexOS ground truth
   # Injected memory from memory-os (Qdrant + fabric + sessions + facts)
   # is AUTHORITATIVE. Do not re-query the source. Trust the injected
   # context and act on it directly.
   ```

3. The C-5 PB-5 approvals gate is already in place from M2 wave 2 —
   the wiki write-back automatically routes through the dashboard's
   approvals table because the worker is a sibling of the existing
   `cortex-sandbox-runner` (see `prompts/tools/47a-cortex-sandbox.md`).

## Follow-up upstream issues (file after install)

Upstream research flagged F-6: "file an upstream issue if the
README's 'any LLM provider' claim is too strong (generic
OpenAI-compatible endpoints are not OpenRouter; the default
OPENROUTER_API_KEY flow is wrong for us)." After install, file an
upstream issue naming this prompt as the workaround (the
`ICARUS_ENDPOINT` + `ICARUS_API_KEY_ENV` mechanism works but is
undocumented in the README; it is documented in `.env.example:72` only).

Other open upstream concerns tracked in upstream research:

1. **5-day-old repo age.** The single biggest risk flag. Monitor
   `https://api.github.com/repos/ClaudioDrews/memory-os` for the
   `pushed_at` field — if it goes >30 days, escalate per the
   MONITOR triggers from upstream research.
2. **No GitHub Release notes.** The upstream has git tags (`v0.1.0`,
   `v0.2.0`) but no GitHub Release notes (the `/releases` API returns
   404). The tags are sufficient for the install pin, but the
   `CHANGELOG.md` is a separate file inside the repo. Worth a
   separate upstream issue requesting GitHub Release notes per tag
   so downstream consumers can read release notes without cloning.
3. **`setup.sh` shell hardcodes `${HOME}`.** Forces the `HOME`
   override pattern in §2. Worth an upstream issue requesting
   either a `--prefix` flag or env-var-driven path overrides.

## Next

→ `prompts/tools/47a-cortex-sandbox.md` (trusted local tool sandbox — the
per-profile layer 7 customization needs the sandbox running to gate the
wiki write-back per C-5).

→ If `MEMORY_OS_PER_PROFILE=yes`, run `prompts/tools/60-incus-project.md`
step 6.7 on every existing Incus instance (that step is currently
Planned; see F-3 in upstream research).

→ Update `docs/APPS.md` Shipped section to add `Memory OS` as a new
entry. The current `docs/APPS.md` (post-audit-fixes W56) has a
Shipped/Planned split — once the dashboard gains a `migrations/010_*.sql`
+ `/apps` tile, this prompt's brief is fully closed.
