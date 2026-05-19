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
- [ ] Detect GPU (A0) and export `CORTEX_OLLAMA_GPU`
- [ ] Install GPU driver if needed (A1)
- [ ] CHECKPOINT 1b confirmed
- [ ] Install Ollama (A2)
- [ ] Write per-backend systemd drop-in (A3)
- [ ] Pull embedding + chat models matched to backend (A4)
- [ ] Verify backend (A5)
- [ ] Install OpenViking from upstream
- [ ] Configure service
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** PostgreSQL is running and the host can reach `127.0.0.1:5432`?

Type `confirmed` to proceed.

## Step A — Install Ollama with GPU auto-detect

Ollama port stays on `11435` (9Router owns `11434`). Backend is picked
from detected hardware; CPU fallback is always safe.

### A0 — Detect GPU

```bash
sudo apt-get install -y pciutils
GPU_LINE=$(lspci -nn | grep -Ei 'vga|3d|display' || true)
echo "$GPU_LINE"

if echo "$GPU_LINE" | grep -qi nvidia; then
  export CORTEX_OLLAMA_GPU=nvidia
elif echo "$GPU_LINE" | grep -qiE 'amd|ati|advanced micro devices'; then
  export CORTEX_OLLAMA_GPU=amd
else
  export CORTEX_OLLAMA_GPU=none
fi
echo "CORTEX_OLLAMA_GPU=$CORTEX_OLLAMA_GPU"
```

### A1 — Install GPU driver if missing

NVIDIA path:

```bash
if [ "$CORTEX_OLLAMA_GPU" = "nvidia" ] && ! command -v nvidia-smi >/dev/null 2>&1; then
  sudo apt-get install -y ubuntu-drivers-common
  sudo ubuntu-drivers install --gpgpu
  echo "NVIDIA driver installed. REBOOT REQUIRED before continuing."
  echo "Run: sudo reboot, then re-enter this prompt at Step A2."
  exit 0
fi
```

AMD path:

```bash
if [ "$CORTEX_OLLAMA_GPU" = "amd" ] && ! command -v rocminfo >/dev/null 2>&1; then
  sudo apt-get install -y wget gnupg
  wget -qO - https://repo.radeon.com/rocm/rocm.gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/rocm.gpg
  UBU_CODENAME=$(. /etc/os-release && echo "$UBUNTU_CODENAME")
  echo "deb [arch=amd64 signed-by=/usr/share/keyrings/rocm.gpg] https://repo.radeon.com/rocm/apt/latest ${UBU_CODENAME} main" | sudo tee /etc/apt/sources.list.d/rocm.list
  sudo apt-get update
  sudo apt-get install -y rocm-hip-runtime rocminfo
  sudo usermod -aG render,video "$USER"
  echo "ROCm installed. REBOOT REQUIRED before continuing."
  echo "Run: sudo reboot, then re-enter this prompt at Step A2."
  exit 0
fi
```

### CHECKPOINT 1b

**STOP — operator question:** `CORTEX_OLLAMA_GPU` is set and (if `nvidia`) `nvidia-smi` reports the GPU, or (if `amd`) `rocminfo` reports an Agent, or (if `none`) the host has no discrete GPU?

Type `confirmed` to proceed.

### A2 — Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo install -d -m 0755 /etc/systemd/system/ollama.service.d
```

### A3 — Per-backend systemd drop-in

```bash
case "$CORTEX_OLLAMA_GPU" in
  nvidia)
    sudo tee /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
Environment=OLLAMA_HOST=127.0.0.1:11435
Environment=OLLAMA_NUM_PARALLEL=2
Environment=OLLAMA_KEEP_ALIVE=10m
EOF
    ;;
  amd)
    sudo tee /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
Environment=OLLAMA_HOST=127.0.0.1:11435
Environment=HSA_OVERRIDE_GFX_VERSION=10.3.0
Environment=OLLAMA_NUM_PARALLEL=2
Environment=OLLAMA_KEEP_ALIVE=10m
EOF
    ;;
  none|*)
    sudo tee /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
Environment=OLLAMA_HOST=127.0.0.1:11435
Environment=CUDA_VISIBLE_DEVICES=
Environment=HIP_VISIBLE_DEVICES=
Environment=OLLAMA_NUM_GPU=0
Environment=OLLAMA_NUM_PARALLEL=2
Environment=OLLAMA_KEEP_ALIVE=10m
EOF
    ;;
esac

sudo systemctl daemon-reload
sudo systemctl enable --now ollama
```

### A4 — Pull models matched to backend

GPU-capable hosts pull `llama3.2:3b`; CPU-only stays on `:1b`.

```bash
if [ "$CORTEX_OLLAMA_GPU" = "none" ]; then
  CORTEX_OLLAMA_CHAT_MODEL=${CORTEX_OLLAMA_CHAT_MODEL:-llama3.2:1b}
else
  CORTEX_OLLAMA_CHAT_MODEL=llama3.2:3b
fi
echo "Chat model: $CORTEX_OLLAMA_CHAT_MODEL"

OLLAMA_HOST=127.0.0.1:11435 ollama pull nomic-embed-text
OLLAMA_HOST=127.0.0.1:11435 ollama pull "$CORTEX_OLLAMA_CHAT_MODEL"
OLLAMA_HOST=127.0.0.1:11435 ollama list
```

### A5 — Verify backend

```bash
sudo journalctl -u ollama -n 200 --no-pager | grep -Ei 'cuda|rocm|gpu|cpu' || true
curl -fsS http://127.0.0.1:11435/api/generate \
  -d "{\"model\":\"${CORTEX_OLLAMA_CHAT_MODEL}\",\"prompt\":\"ok\",\"stream\":false}" \
  | jq '{eval_duration, eval_count}'
```

Expected:

- NVIDIA backend: journal mentions `cuda` / `nvidia`; `eval_duration` low.
- AMD backend: journal mentions `rocm` / `hip`.
- CPU backend: journal mentions `cpu`; `eval_duration` higher, still completes.

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
OLLAMA_CHAT_MODEL=${CORTEX_OLLAMA_CHAT_MODEL:-llama3.2:1b}
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
    "model": "${OLLAMA_CHAT_MODEL}"
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
