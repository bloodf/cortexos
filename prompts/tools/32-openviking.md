# OpenViking (latest)

## Purpose

Install OpenViking as the canonical long-term memory backend for OpenClaw.
OpenViking is the single source of truth for agent memory; Hindsight is retired.

## Prerequisites

- `14-postgresql.md` completed.
- `31-9router.md` completed.
- `30-nats.md` completed.
- Node and Python build prerequisites available on the host.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

```bash
sudo -v
```

## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Install Ollama
- [ ] Pull local models
- [ ] Install OpenViking from upstream
- [ ] Configure service
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** PostgreSQL is running and the host can reach `127.0.0.1:5432`?

Type `confirmed` to proceed.

## Step A — Install Ollama

Use Ollama as the local model runtime. Keep the port off `11434` because 9Router owns that port.

```bash
curl -fsSL https://ollama.com/install.sh | sh

sudo install -d -m 0755 /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
Environment=OLLAMA_HOST=127.0.0.1:11435
# CPU-only fallback is always safe. Remove these lines only after explicitly
# validating a GPU-capable host/runtime.
Environment=CUDA_VISIBLE_DEVICES=
Environment=HIP_VISIBLE_DEVICES=
Environment=OLLAMA_NUM_GPU=0
Environment=OLLAMA_NUM_PARALLEL=2
Environment=OLLAMA_KEEP_ALIVE=10m
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now ollama
```

Pull at least one embedding model and one small chat model:

```bash
OLLAMA_HOST=127.0.0.1:11435 ollama pull nomic-embed-text
OLLAMA_HOST=127.0.0.1:11435 ollama pull llama3.2:1b
OLLAMA_HOST=127.0.0.1:11435 ollama list
curl -fsS http://127.0.0.1:11435/api/tags | jq '.models[].name'
```

## Step B — Install OpenViking

Current upstream is the Python project at `volcengine/OpenViking`.

```bash
sudo apt-get install -y python3-pip python3-venv pipx cargo rustc cmake pkg-config libssl-dev libsqlite3-dev
pipx install uv || true
curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | sh -s -- -y || true
. "$HOME/.cargo/env"

rm -rf /opt/cortexos/stacks/openviking
git clone https://github.com/volcengine/OpenViking /opt/cortexos/stacks/openviking
cd /opt/cortexos/stacks/openviking
"${HOME}/.local/bin/uv" venv .venv
"${HOME}/.local/bin/uv" pip install -e .
```

## Configure

```bash
sudo tee /opt/cortexos/.secrets/openviking.env <<EOF
OPENVIKING_ROOT_API_KEY=$(openssl rand -hex 32)
OPENVIKING_CONFIG_FILE=/opt/cortexos/openviking/ov.conf
OLLAMA_BASE_URL=http://127.0.0.1:11435
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=llama3.2:1b
EOF
sudo chmod 600 /opt/cortexos/.secrets/openviking.env
```

Write `ov.conf` directly:

```bash
sudo install -d -m 0755 /opt/cortexos/openviking
. /opt/cortexos/.secrets/openviking.env
sudo tee /opt/cortexos/openviking/ov.conf <<EOF
{
  "server": {
    "host": "127.0.0.1",
    "port": 18790,
    "root_api_key": "${OPENVIKING_ROOT_API_KEY}",
    "cors_origins": ["*"]
  },
  "storage": {
    "workspace": "/opt/cortexos/openviking/data",
    "agfs": { "backend": "local" },
    "vectordb": { "backend": "local" }
  },
  "embedding": {
    "dense": {
      "api_base": "http://127.0.0.1:11435/v1",
      "api_key": "ollama",
      "provider": "openai",
      "dimension": 768,
      "model": "nomic-embed-text"
    }
  },
  "vlm": {
    "api_base": "http://127.0.0.1:11435/v1",
    "api_key": "ollama",
    "provider": "openai",
    "model": "llama3.2:1b"
  }
}
EOF
sudo chmod 600 /opt/cortexos/openviking/ov.conf
sudo chown -R "$USER:$USER" /opt/cortexos/openviking
```

Systemd unit:

```bash
sudo tee /etc/systemd/system/openviking.service <<'EOF'
[Unit]
Description=OpenViking memory backend
After=network-online.target ollama.service
Wants=network-online.target ollama.service

[Service]
Type=simple
User=cortexos
WorkingDirectory=/opt/cortexos/stacks/openviking
Environment=HOME=/home/cortexos
EnvironmentFile=/opt/cortexos/.secrets/openviking.env
ExecStart=/opt/cortexos/stacks/openviking/.venv/bin/openviking-server --config /opt/cortexos/openviking/ov.conf --host 127.0.0.1 --port 18790
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now openviking
```

## Verify

```bash
curl -fsS http://127.0.0.1:18790/health
curl -fsS http://127.0.0.1:11435/api/embeddings \
  -d '{"model":"nomic-embed-text","prompt":"cortexos"}' \
  | jq '.embedding | length'
```

Expected:
- OpenViking health returns OK.
- Ollama embeddings return an integer `> 0`.

## CHECKPOINT 2

**STOP — operator question:** OpenViking `/health` returns OK and Ollama embeddings work end-to-end?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/33-leann.md`
