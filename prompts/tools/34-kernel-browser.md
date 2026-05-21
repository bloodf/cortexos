# Kernel Browser (latest)

## Purpose

Install a headless Chromium-based browser service that AI agents can control programmatically via the Kernel Browser API for web scraping and browser automation tasks.

## Prerequisites

- `11-docker.md` completed.
- `31-9router.md` completed (agents route requests through 9Router).

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

- [ ] CHECKPOINT 1 confirmed — VPS has ≥ 2 GB free RAM
- [ ] Write `/opt/cortexos/stacks/kernel-browser/docker-compose.yml` (image `browserless/chromium`)
- [ ] Write `/opt/cortexos/.secrets/kernel-browser.env` (mode 0600) with `KERNEL_BROWSER_TOKEN`
- [ ] `docker compose --env-file /opt/cortexos/.secrets/kernel-browser.env up -d`
- [ ] Confirm `curl http://localhost:3333/json/version?token=...` returns version JSON
- [ ] CHECKPOINT 2 confirmed — `/json/version` returns version JSON

## CHECKPOINT 1

**STOP — operator question:** Does `free -m | awk '/^Mem:/ {print $7}'` print a value ≥ `2000` (at least 2 GB available)?

Type `confirmed` to proceed.

## Install

```bash
mkdir -p /opt/cortexos/stacks/kernel-browser

tee /opt/cortexos/stacks/kernel-browser/docker-compose.yml <<'EOF'
services:
  kernel-browser:
    image: browserless/chromium
    restart: unless-stopped
    environment:
      TOKEN: ${KERNEL_BROWSER_TOKEN}
      MAX_CONCURRENT_SESSIONS: 5
      CONNECTION_TIMEOUT: 60000
    ports:
      - "127.0.0.1:3333:3000"

EOF
```

Write env:

```bash
sudo tee /opt/cortexos/.secrets/kernel-browser.env <<EOF
KERNEL_BROWSER_TOKEN={KERNEL_BROWSER_TOKEN}
EOF
sudo chmod 600 /opt/cortexos/.secrets/kernel-browser.env
```

```bash
cd /opt/cortexos/stacks/kernel-browser
docker compose --env-file /opt/cortexos/.secrets/kernel-browser.env up -d
```

## Verify

```bash
curl -s "http://localhost:3333/json/version?token={KERNEL_BROWSER_TOKEN}"
```

Expected: JSON with browser version information.

## CHECKPOINT 2

**STOP — operator question:** Did `curl -s "http://localhost:3333/json/version?token={KERNEL_BROWSER_TOKEN}"` return a JSON body containing `Browser` and `WebKit-Version` keys (not `401 Unauthorized`, not empty)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/40-hermes.md`
