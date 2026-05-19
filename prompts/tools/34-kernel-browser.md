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


## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed
## CHECKPOINT 1

**STOP — operator question:** The VPS has at least 2 GB free RAM (browser processes are memory-intensive)?

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

**STOP — operator question:** The browser API responds with version JSON?

Type `confirmed` to proceed.
## Next

→ `prompts/tools/40-openclaw.md`
