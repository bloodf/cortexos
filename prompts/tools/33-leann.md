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

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — OpenViking up + 9Router serving embedding models
- [ ] `git clone https://github.com/leann-rag/leann /opt/cortexos/stacks/leann` + `npm install`
- [ ] Snapshot upstream README to `docs/external/leann.snapshot.md` with header
- [ ] Write `/opt/cortexos/.secrets/leann.env` (mode 0600, port 18791)
- [ ] Write `/etc/systemd/system/leann.service` with `uvicorn leann.server:app`
- [ ] `sudo systemctl daemon-reload && sudo systemctl enable --now leann`
- [ ] Confirm `curl http://localhost:18791/health` returns OK
- [ ] CHECKPOINT 2 confirmed — `/health` returns ok

## CHECKPOINT 1

**STOP — operator question:** Does `curl -fsS http://localhost:18790/health` return `{"status":"ok"}` (proving OpenViking is up)?

Type `confirmed` to proceed.

## CHECKPOINT 1b

**STOP — operator question:** Does `curl -H "Authorization: Bearer $NINEROUTER_API_KEY" http://127.0.0.1:11434/v1/models | jq '.data | length'` print an integer > 0 (proving 9Router serves at least one embedding-capable model)?

Type `confirmed` to proceed.

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
NINEROUTER_BASE_URL=http://127.0.0.1:11434
NINEROUTER_API_KEY={9ROUTER_API_KEY}
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

**STOP — operator question:** Does `curl -s http://localhost:18791/health` print a JSON OK response (not `connection refused`, not HTTP 502)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/34-kernel-browser.md`
