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

- [ ] CHECKPOINT 1 confirmed — OpenViking up + 9Router models reachable
- [ ] Install Python 3 venv at `/opt/cortexos/stacks/leann/.venv`
- [ ] `pip install leann==0.3.7 uvicorn`
- [ ] Write `/opt/cortexos/.secrets/leann.env` (mode 0600, port 18791)
- [ ] Write `/etc/systemd/system/leann.service`
- [ ] `sudo systemctl daemon-reload && sudo systemctl enable --now leann`
- [ ] Confirm `curl http://localhost:18791/health` returns OK
- [ ] CHECKPOINT 2 confirmed — `/health` returns ok

## CHECKPOINT 1

**STOP — operator question:** Does `curl -fsS http://localhost:18790/health` return `{"status":"ok"}` (proving OpenViking is up)?

Type `confirmed` to proceed.

## CHECKPOINT 1b

**STOP — operator question:** Does `curl -H "Authorization: Bearer $NINEROUTER_API_KEY" http://127.0.0.1:11434/v1/models | jq '.data | length'` print an integer > 0?

Type `confirmed` to proceed.

## Install

```bash
sudo install -d -m 0755 /opt/cortexos/stacks/leann /opt/cortexos/stacks/leann/data
sudo chown -R "$USER:$USER" /opt/cortexos/stacks/leann
python3 -m venv /opt/cortexos/stacks/leann/.venv
/opt/cortexos/stacks/leann/.venv/bin/pip install --upgrade pip
/opt/cortexos/stacks/leann/.venv/bin/pip install 'leann==0.3.7' uvicorn
```

## Configure

Write `/opt/cortexos/.secrets/leann.env`:

```bash
sudo tee /opt/cortexos/.secrets/leann.env <<EOF
LEANN_PORT=18791
NINEROUTER_BASE_URL=http://127.0.0.1:11434
NINEROUTER_API_KEY=${NINEROUTER_API_KEY}
LEANN_DATA_DIR=/opt/cortexos/stacks/leann/data
EOF
sudo chmod 600 /opt/cortexos/.secrets/leann.env
```

Write systemd unit:

```bash
sudo tee /etc/systemd/system/leann.service <<'EOF'
[Unit]
Description=LEANN document RAG
After=network-online.target 9router.service openviking.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/cortexos/stacks/leann
EnvironmentFile=/opt/cortexos/.secrets/leann.env
ExecStart=/opt/cortexos/stacks/leann/.venv/bin/uvicorn leann.server:app --host 127.0.0.1 --port 18791
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now leann
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
