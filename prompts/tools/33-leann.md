# LEANN (latest)

## Purpose

Install LEANN as the document-RAG (retrieval-augmented generation) layer. LEANN indexes documents and answers semantic queries, complementing OpenViking's episodic memory.

## Prerequisites

- `32-openviking.md` completed.
- `31-9router.md` completed (LEANN uses 9Router for embeddings).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

> **Python runtime.** LEANN's systemd unit invokes `uvicorn` from the system Python. Install Python deps with `pkg_install python3 python3-pip` (Ubuntu/Debian). The `uvicorn` binary itself comes from `pip install uvicorn` inside the LEANN tree or a venv.

## CHECKPOINT 1

Operator: confirm OpenViking is running and 9Router is serving embedding models. Type "confirmed" to proceed.

## Install

```bash
git clone https://github.com/leann-rag/leann /opt/cortexos/stacks/leann
cd /opt/cortexos/stacks/leann
npm install
```

Snapshot upstream install docs:

```bash
# See docs/external/ — add leann.snapshot.md if not present
curl -fsSL https://raw.githubusercontent.com/leann-rag/leann/HEAD/README.md \
  > docs/external/leann.snapshot.md
# Prepend required header
sed -i '1s/^/<!-- Snapshot of upstream leann at probe time. NOT a version pin. Operator reinstalls latest upstream on each fresh install. -->\n/' \
  docs/external/leann.snapshot.md
```

## Configure

Write `/opt/cortexos/.secrets/leann.env`:

```bash
sudo tee /opt/cortexos/.secrets/leann.env <<EOF
LEANN_PORT=18791
NINE_ROUTER_BASE_URL=http://127.0.0.1:11434/v1
NINE_ROUTER_API_KEY={9ROUTER_API_KEY}
LEANN_DATA_DIR=/opt/cortexos/stacks/leann/data
EOF
sudo chmod 600 /opt/cortexos/.secrets/leann.env

mkdir -p /opt/cortexos/stacks/leann/data
```

Write systemd unit:

```bash
sudo tee /etc/systemd/system/leann.service <<'EOF'
[Unit]
Description=LEANN document RAG
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/cortexos/stacks/leann
EnvironmentFile=/opt/cortexos/.secrets/leann.env
# LEANN ships an ASGI app. `python -m leann` does NOT bind the port
# in headless mode — use uvicorn explicitly. Confirmed on the live VPS
# during Phase H: bare `python -m` exited 0 immediately, uvicorn-invoked
# unit bound :18791 and stayed active.
ExecStart=/usr/bin/env uvicorn leann.server:app --host 127.0.0.1 --port 18791
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable leann
sudo systemctl start leann
```

## Verify

```bash
curl -s http://localhost:18791/health
```

Expected: health OK response.

## CHECKPOINT 2

Operator: confirm LEANN health endpoint returns OK. Type "confirmed" to proceed.

## Next

→ `prompts/tools/34-kernel-browser.md`
