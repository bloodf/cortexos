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
- [ ] Detect GPU vendor via `lspci` (sets `CORTEX_OLLAMA_GPU=nvidia|amd|none`)
- [ ] Install NVIDIA driver / AMD ROCm if GPU detected + driver missing (reboot if installed)
- [ ] Install Ollama via `curl https://ollama.com/install.sh | sh`
- [ ] Drop in systemd override matching `CORTEX_OLLAMA_GPU` — port 11435, GPU policy
- [ ] `ollama pull nomic-embed-text`
- [ ] `ollama pull llama3.2:1b` (CPU) or `llama3.2:3b` (GPU)
- [ ] Clone OpenViking into `/opt/cortexos/stacks/openviking`, `npm install`
- [ ] Write `/opt/cortexos/.secrets/openviking.env` (mode 0600)
- [ ] Run `npm run migrate`
- [ ] Install + enable `openviking.service`
- [ ] CHECKPOINT 2 confirmed — `/health` returns `{"status":"ok"}`
- [ ] CHECKPOINT 3 confirmed — `/api/embeddings` returns positive vector length

## CHECKPOINT 1

**STOP — operator question:** PostgreSQL is running and the `cortex_dashboard` database is accessible?

Type `confirmed` to proceed.

## CHECKPOINT 1b

**STOP — operator question:** Does `echo "$CORTEX_OLLAMA_GPU"` print exactly one of `nvidia`, `amd`, or `none`, AND — if the value is `nvidia` — does `nvidia-smi` list the GPU and driver version (or, if `amd`, does `rocminfo` print a GPU "Name:" line)?

If you just installed a driver and the spoke told you to reboot, reboot now and re-run this spoke from the top — the install steps below are idempotent.

Type `confirmed` to proceed.

## Step A — Install Ollama with GPU auto-detect

Ollama gives OpenViking a local LLM endpoint for embeddings and small inference without burning 9Router quota. Ollama will run on GPU if one is present + driver is installed, otherwise CPU. This step detects the GPU, installs the matching driver if missing, then configures Ollama accordingly.

### A0 — Detect GPU

Identify GPU vendor (NVIDIA / AMD / none) from PCI bus:

```bash
# Sets CORTEX_OLLAMA_GPU to: nvidia | amd | none
command -v lspci >/dev/null 2>&1 || sudo apt-get install -y pciutils

GPU_LINE=$(lspci -nn | grep -Ei 'vga|3d|display' || true)
if   echo "$GPU_LINE" | grep -qi 'nvidia';       then CORTEX_OLLAMA_GPU=nvidia
elif echo "$GPU_LINE" | grep -qiE 'amd|ati';     then CORTEX_OLLAMA_GPU=amd
else                                                  CORTEX_OLLAMA_GPU=none
fi
export CORTEX_OLLAMA_GPU
echo "Detected GPU vendor: $CORTEX_OLLAMA_GPU"
echo "Detected GPU line:   ${GPU_LINE:-<none>}"
```

### A1 — Install GPU driver if needed

**NVIDIA:** install the open-source driver via Ubuntu/Debian's `ubuntu-drivers` (or fallback to `nvidia-driver-<latest>`), then verify `nvidia-smi`. Skip entirely if `CORTEX_OLLAMA_GPU != nvidia`.

```bash
if [ "$CORTEX_OLLAMA_GPU" = "nvidia" ]; then
  if ! command -v nvidia-smi >/dev/null 2>&1; then
    echo "NVIDIA GPU detected, driver missing — installing"
    if command -v ubuntu-drivers >/dev/null 2>&1; then
      sudo ubuntu-drivers install --gpgpu
    else
      sudo apt-get install -y "$(apt-cache search '^nvidia-driver-[0-9]+$' \
        | sort -V | tail -n1 | awk '{print $1}')"
    fi
    echo "NVIDIA driver installed — REBOOT REQUIRED before Ollama can use GPU."
    echo "After reboot, re-run this spoke; the install.sh + systemd steps below are idempotent."
    # Driver load needs reboot; do not continue this run on a fresh install.
    test "${CORTEX_REBOOT_OK:-}" = "1" && sudo reboot
    exit 0
  fi
  nvidia-smi
fi
```

**AMD:** install ROCm runtime + verify `rocminfo`. Skip if `CORTEX_OLLAMA_GPU != amd`.

```bash
if [ "$CORTEX_OLLAMA_GPU" = "amd" ]; then
  if ! command -v rocminfo >/dev/null 2>&1; then
    echo "AMD GPU detected, ROCm missing — installing"
    sudo apt-get install -y "linux-headers-$(uname -r)" wget gnupg
    wget -qO- https://repo.radeon.com/rocm/rocm.gpg.key \
      | sudo gpg --dearmor -o /etc/apt/keyrings/rocm.gpg
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/rocm.gpg] \
https://repo.radeon.com/rocm/apt/latest jammy main" \
      | sudo tee /etc/apt/sources.list.d/rocm.list
    sudo apt-get update -y
    sudo apt-get install -y rocm-hip-runtime rocminfo
    sudo usermod -aG render,video "$USER"
    echo "AMD ROCm installed — REBOOT REQUIRED for kernel module + group membership."
    test "${CORTEX_REBOOT_OK:-}" = "1" && sudo reboot
    exit 0
  fi
  rocminfo | grep -E 'Name:|Marketing Name' | head
fi
```

**None:** nothing to install — Ollama will run on CPU.

```bash
[ "$CORTEX_OLLAMA_GPU" = "none" ] && echo "No GPU detected — Ollama will run on CPU."
```

### A2 — Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

The installer creates the `ollama` systemd unit (`/etc/systemd/system/ollama.service`) and starts it. On GPU hosts the installer's post-install auto-detects CUDA/ROCm and prints the active runtime — capture that line from `systemctl status ollama` for the audit log.

### A3 — Systemd drop-in (port + GPU policy)

9Router owns port 11434, so Ollama moves to 11435 regardless of GPU. Drop-in contents differ by `CORTEX_OLLAMA_GPU`:

```bash
sudo install -d -m 0755 /etc/systemd/system/ollama.service.d

case "$CORTEX_OLLAMA_GPU" in
  nvidia)
    sudo tee /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
Environment=OLLAMA_HOST=127.0.0.1:11435
# All visible NVIDIA GPUs available to Ollama.
Environment=CUDA_VISIBLE_DEVICES=all
# Let Ollama pick how many layers to offload per model (auto).
Environment=OLLAMA_NUM_PARALLEL=2
Environment=OLLAMA_KEEP_ALIVE=10m
# Flash attention on NVIDIA for big speedup on 7B+ models.
Environment=OLLAMA_FLASH_ATTENTION=1
EOF
    ;;
  amd)
    sudo tee /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
Environment=OLLAMA_HOST=127.0.0.1:11435
# All visible AMD GPUs available to Ollama (HSA override prevents
# silent fallback to CPU when ROCm cannot probe gfx version).
Environment=HSA_OVERRIDE_GFX_VERSION=10.3.0
Environment=HIP_VISIBLE_DEVICES=0
Environment=OLLAMA_NUM_PARALLEL=2
Environment=OLLAMA_KEEP_ALIVE=10m
EOF
    ;;
  none|*)
    sudo tee /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
Environment=OLLAMA_HOST=127.0.0.1:11435
# Force CPU mode — no GPU detected. Without these, Ollama probes for
# CUDA/ROCm at startup and prints spurious "no devices" warnings.
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

### A4 — Pull models

`nomic-embed-text` is the canonical OpenViking embedding model. Chat model size depends on GPU: GPU hosts can afford `llama3.2:3b`; CPU-only stays on `llama3.2:1b`.

```bash
OLLAMA_HOST=127.0.0.1:11435 ollama pull nomic-embed-text
if [ "$CORTEX_OLLAMA_GPU" = "none" ]; then
  OLLAMA_HOST=127.0.0.1:11435 ollama pull llama3.2:1b
else
  OLLAMA_HOST=127.0.0.1:11435 ollama pull llama3.2:3b
fi
OLLAMA_HOST=127.0.0.1:11435 ollama list
```

### A5 — Verify

Ollama reachable on override port:

```bash
curl -fsS http://127.0.0.1:11435/api/tags | jq '.models[].name'
```

Expected: at least `nomic-embed-text:latest` and the chat model listed.

Confirm Ollama picked up the GPU runtime (skip for `none`):

```bash
if [ "$CORTEX_OLLAMA_GPU" != "none" ]; then
  journalctl -u ollama -n 100 --no-pager | grep -Ei 'cuda|rocm|gpu|inference' | tail
  # GPU host should show a line like "detected GPUs" or "library=cuda".
fi
```

Then run a real inference probe and check whether it landed on GPU. The trailing `eval_count` line in the streamed `/api/generate` response includes `eval_duration` — a GPU run is typically 10–50x faster than CPU for the same prompt:

```bash
curl -fsS http://127.0.0.1:11435/api/generate \
  -d "{\"model\":\"$( [ "$CORTEX_OLLAMA_GPU" = "none" ] && echo llama3.2:1b || echo llama3.2:3b )\",\"prompt\":\"hello\",\"stream\":false}" \
  | jq '{eval_count, eval_duration_ms: (.eval_duration/1000000|floor)}'
```

> **Why this matters.** Without the GPU detection branch, the drop-in forced `OLLAMA_NUM_GPU=0` on hosts that had a perfectly good NVIDIA / AMD card — every embedding and chat call ran on CPU at ~5% of the achievable throughput.

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
OLLAMA_CHAT_MODEL=llama3.2:1b  # bump to llama3.2:3b on GPU hosts (see Step A4)
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

**STOP — operator question:** Did the `/api/embeddings` curl print a positive integer (typically 768) — proving the Ollama embedding path works on the selected backend (`$CORTEX_OLLAMA_GPU`), not an empty array or HTTP error?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/33-leann.md`
