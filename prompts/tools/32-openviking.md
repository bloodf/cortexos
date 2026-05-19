# OpenViking (latest)

## Purpose

Install OpenViking as the canonical long-term memory backend for OpenClaw. OpenViking is the single source of truth for agent memory; Hindsight is retired.

## Prerequisites

- `14-postgresql.md` completed (OpenViking stores memory in PostgreSQL).
- `31-9router.md` completed (OpenViking calls cloud AI providers through 9Router).
- `30-nats.md` completed.
- A local CPU-only LLM runtime (Ollama) so OpenViking can run embeddings and small inference jobs without paying for or depending on a cloud provider. Installed by **Step A** below.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — PostgreSQL up + `cortex_dashboard` reachable
- [ ] Install Ollama via `curl https://ollama.com/install.sh | sh`
- [ ] Drop in systemd override: `OLLAMA_HOST=127.0.0.1:11435`, CPU-only
- [ ] `ollama pull nomic-embed-text`
- [ ] `ollama pull llama3.2:1b`
- [ ] Clone OpenViking into `/opt/cortexos/stacks/openviking`, `npm install`
- [ ] Write `/opt/cortexos/.secrets/openviking.env` (mode 0600)
- [ ] Run `npm run migrate`
- [ ] Install + enable `openviking.service`
- [ ] CHECKPOINT 2 confirmed — `/health` returns `{"status":"ok"}`
- [ ] CHECKPOINT 3 confirmed — `/api/embeddings` returns positive vector length

## CHECKPOINT 1

**STOP — operator question:** PostgreSQL is running and the `cortex_dashboard` database is accessible?

Type `confirmed` to proceed.

## Step A — Install Ollama (CPU-only)

Ollama gives OpenViking a local LLM endpoint for embeddings and small inference without burning 9Router quota. The CortexOS host has no GPU, so Ollama runs on CPU only.

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

The installer creates the `ollama` systemd unit (`/etc/systemd/system/ollama.service`) and starts it. Override the listen address + force CPU-only via a drop-in (avoids port-11434 conflict with 9Router, which owns that port for the OpenAI-compatible gateway):

```bash
sudo install -d -m 0755 /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
# 9Router owns 11434; move Ollama to 11435 to avoid the bind clash.
Environment=OLLAMA_HOST=127.0.0.1:11435
# Force CPU mode — the VPS has no GPU and partial offload to absent
# hardware causes silent fallbacks + slow startups.
Environment=CUDA_VISIBLE_DEVICES=
Environment=HIP_VISIBLE_DEVICES=
Environment=OLLAMA_NUM_GPU=0
# Reasonable defaults for a shared host.
Environment=OLLAMA_NUM_PARALLEL=2
Environment=OLLAMA_KEEP_ALIVE=10m
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now ollama
```

Pull at least one CPU-friendly model. `nomic-embed-text` is the canonical OpenViking embedding model; `llama3.2:1b` is the smallest viable chat model for CPU inference:

```bash
OLLAMA_HOST=127.0.0.1:11435 ollama pull nomic-embed-text
OLLAMA_HOST=127.0.0.1:11435 ollama pull llama3.2:1b
OLLAMA_HOST=127.0.0.1:11435 ollama list
```

Verify Ollama is reachable on the override port:

```bash
curl -fsS http://127.0.0.1:11435/api/tags | jq '.models[].name'
```

Expected: at least `nomic-embed-text:latest` and `llama3.2:1b` listed. HTTP error here means the systemd drop-in did not take — re-check `systemctl status ollama` and `journalctl -u ollama -n 50`.

## Step B — Install OpenViking

```bash
git clone https://github.com/openviking/openviking /opt/cortexos/stacks/openviking
cd /opt/cortexos/stacks/openviking
npm install
```

## Configure

Write `/opt/cortexos/.secrets/openviking.env`:

```bash
sudo tee /opt/cortexos/.secrets/openviking.env <<EOF
DATABASE_URL=postgresql://dashboard:{DASHBOARD_DB_PASSWORD}@127.0.0.1:5432/cortex_dashboard
NINEROUTER_BASE_URL=http://127.0.0.1:11434
NINEROUTER_API_KEY={9ROUTER_API_KEY}
NATS_URL=nats://127.0.0.1:4222
OPENVIKING_PORT=18790
# Local CPU LLM via Ollama (Step A). OpenViking prefers OLLAMA_* for
# embeddings + small inference and falls back to 9Router for chat.
OLLAMA_BASE_URL=http://127.0.0.1:11435
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=llama3.2:1b
EOF
sudo chmod 600 /opt/cortexos/.secrets/openviking.env
```

Apply OpenViking schema migrations:

```bash
cd /opt/cortexos/stacks/openviking
npm run migrate
```

Write systemd unit:

```bash
sudo tee /etc/systemd/system/openviking.service <<'EOF'
[Unit]
Description=OpenViking memory backend
After=postgresql.service nats.service ollama.service
Wants=ollama.service

[Service]
Type=simple
WorkingDirectory=/opt/cortexos/stacks/openviking
EnvironmentFile=/opt/cortexos/.secrets/openviking.env
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable openviking
sudo systemctl start openviking
```

## Verify

OpenViking service:

```bash
curl -fsS http://localhost:18790/health
```

Expected: `{"status":"ok"}` or similar health response.

Ollama CPU embedding round-trip (proves OpenViking's local-LLM path is wired):

```bash
curl -fsS http://127.0.0.1:11435/api/embeddings \
  -d '{"model":"nomic-embed-text","prompt":"cortexos"}' \
  | jq '.embedding | length'
```

Expected: an integer > 0 (vector length, typically 768 for `nomic-embed-text`).

## CHECKPOINT 2

**STOP — operator question:** Did `curl -fsS http://localhost:18790/health` return `{"status":"ok"}` (not 404, not connection refused)?

Type `confirmed` to proceed.

## CHECKPOINT 3

**STOP — operator question:** Did the `/api/embeddings` curl print a positive integer (typically 768) — proving the CPU embedding path through Ollama works, not an empty array or HTTP error?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/33-leann.md`
