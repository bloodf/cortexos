# Incus Project Setup

## Purpose

Create a new Incus container instance for a project with full AI agent setup.

## Prerequisites

- Incus installed and configured
- Base image available (cortexos-base or cortexos-gastown-base)
- Tailscale configured on host

## Ask User

**Project name:** (e.g., myproject)
**Base image:** cortexos-base or cortexos-gastown-base
**GitHub repo:** (new or existing)
**Hermes profile:** (yes/no)
**Hermes Web UI per-profile:** (yes/no) — only relevant if the host has Hermes Web UI installed and you want a per-profile UI on this instance. See `prompts/tools/30-hermes-webui.md` Ask User block.
**Telegram bot:** (yes/no)

## Step 1: Create Incus Instance

```bash
# Create instance from base image
sudo incus launch cortexos-base:latest "PROJECT_NAME" \
  --config raw.lxc="lxc.cgroup.devices.allow = c 10:200 rwm" \
  --config security.nesting=true

# Wait for instance to start
sleep 5

# Get instance IP
sudo incus list "PROJECT_NAME" -c n4
```

## Step 2: Configure Instance

```bash
# Push SSH key
sudo incus file push ~/.ssh/id_ed25519 "PROJECT_NAME"/home/cortexos/.ssh/
sudo incus exec "PROJECT_NAME" -- chown -R cortexos:cortexos /home/cortexos/.ssh

# Install Tailscale
sudo incus exec "PROJECT_NAME" -- curl -fsSL https://tailscale.com/install.sh | sh

# Start Tailscale
sudo incus exec "PROJECT_NAME" -- tailscale up --accept-routes

# Install fzf (fuzzy-finder CLI). Idempotent — the `||` short-circuit
# skips the apt step if fzf is already present.
sudo incus exec "PROJECT_NAME" -- bash -c "command -v fzf >/dev/null || apt-get install -y -qq fzf"
```

## Step 3: GitHub Setup

### Option A: New Repository

```bash
# Create repo via GitHub CLI
gh repo create "OWNER/PROJECT_NAME" --private --clone

# Or via API
curl -X POST https://api.github.com/user/repos \
  -H "Authorization: token YOUR_TOKEN" \
  -d '{"name":"PROJECT_NAME","private":true}'
```

### Option B: Clone Existing

```bash
sudo incus exec "PROJECT_NAME" -- su - cortexos -c "git clone git@github.com:OWNER/PROJECT_NAME.git"
```

## Step 4: Hermes Profile Setup (Optional)

```bash
# Create Hermes profile directory
sudo incus exec "PROJECT_NAME" -- mkdir -p /opt/cortexos/hermes/profiles/PROJECT_NAME

# Create config
sudo incus exec "PROJECT_NAME" -- tee /opt/cortexos/hermes/profiles/PROJECT_NAME/config.yaml <<EOF
profile: PROJECT_NAME
home: /opt/cortexos/hermes/profiles/PROJECT_NAME
api:
  host: 127.0.0.1
  port: 8932
  publicPath: /hermes/PROJECT_NAME/v1
model:
  provider: 9router
  baseUrl: http://127.0.0.1:11434/v1
  id: cc/claude-opus-4-8
  reasoning: true
memory:
  provider: honcho
  baseUrl: http://127.0.0.1:18690
  workspace: PROJECT_NAME
EOF
```

## Step 5: Telegram Bot Setup (Optional)

```bash
# Ask user for Telegram bot token
read -p "Telegram Bot Token: " BOT_TOKEN
read -p "Allowed Chat ID: " CHAT_ID

# Update Hermes config with Telegram
sudo incus exec "PROJECT_NAME" -- tee -a /opt/cortexos/hermes/profiles/PROJECT_NAME/config.yaml <<EOF
telegram:
  token: "${BOT_TOKEN}"
  allow_from:
    - "${CHAT_ID}"
  allow_admin_from:
    - "${CHAT_ID}"
EOF
```

## Step 6: Start Hermes Gateway

```bash
# Create systemd service
sudo incus exec "PROJECT_NAME" -- tee /etc/systemd/system/hermes-gateway-PROJECT_NAME.service <<EOF
[Unit]
Description=Hermes Gateway - PROJECT_NAME
After=network.target

[Service]
Type=simple
User=cortexos
WorkingDirectory=/opt/cortexos/hermes/profiles/PROJECT_NAME
ExecStart=/usr/local/bin/hermes --profile PROJECT_NAME
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo incus exec "PROJECT_NAME" -- systemctl enable --now hermes-gateway-PROJECT_NAME
```

## Step 6.5: Install Hermes Web UI per profile (Optional)

The per-profile Hermes Web UI is the operator-facing surface on top of the
Hermes agent runtime (which Step 6 already started). Pattern mirrors the
`hermes-gateway-<profile>.service` unit above — a systemd unit per
profile, running in the Incus instance, fronted by the instance's Caddy
(or by the host Caddy if the instance is on the tailnet).

Skip this step if the host already exposes Hermes Web UI at `/hermes/<profile>/` (i.e. you answered `no` to "Per-profile install?" in `prompts/tools/30-hermes-webui.md`).

```bash
# Pull the image inside the instance
sudo incus exec "PROJECT_NAME" -- docker pull ghcr.io/nesquena/hermes-webui:v0.51.280

# Per-profile state dir (writable by the hermeswebui container user)
sudo incus exec "PROJECT_NAME" -- install -d -m 0755 -o 1000 -g 1000 /var/lib/hermes-webui-PROJECT_NAME

# Per-profile env file (no password here — the loopback bind means
# Caddy basicauth + host-level exposure is the security control;
# see prompts/tools/30-hermes-webui.md for the host install pattern).
sudo incus exec "PROJECT_NAME" -- tee /opt/cortexos/hermes-webui-PROJECT_NAME.env >/dev/null <<EOF
HERMES_WEBUI_STATE_DIR=/var/lib/hermes-webui-PROJECT_NAME
HERMES_WEBUI_HOST=127.0.0.1
HERMES_WEBUI_PORT=8933
HERMES_WEBUI_NO_BROWSER=1
HERMES_WEBUI_AGENT_DIR=/opt/cortexos/hermes/profiles/PROJECT_NAME
EOF

# docker-compose wrapper
sudo incus exec "PROJECT_NAME" -- install -d /opt/cortexos/hermes-webui-PROJECT_NAME
sudo incus file push /dev/stdin "PROJECT_NAME"/opt/cortexos/hermes-webui-PROJECT_NAME/docker-compose.yml <<'YAML'
services:
  hermes-webui:
    image: ghcr.io/nesquena/hermes-webui:v0.51.280
    container_name: hermes-webui-PROJECT_NAME
    restart: unless-stopped
    env_file:
      - /opt/cortexos/hermes-webui-PROJECT_NAME.env
    ports:
      - "127.0.0.1:8933:8787"
    volumes:
      - /var/lib/hermes-webui-PROJECT_NAME:/data
    healthcheck:
      test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8787/health', timeout=2).read()"]
      interval: 30s
      timeout: 3s
      retries: 3
YAML

# systemd unit (one per profile, mirrors hermes-gateway-PROJECT_NAME.service)
sudo incus exec "PROJECT_NAME" -- tee /etc/systemd/system/hermes-webui-PROJECT_NAME.service <<'UNIT'
[Unit]
Description=Hermes Web UI - PROJECT_NAME
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/cortexos/hermes-webui-PROJECT_NAME
ExecStart=/usr/bin/docker compose up -d --remove-orphans --wait
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose pull && /usr/bin/docker compose up -d --remove-orphans
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
UNIT

# Enable + start
sudo incus exec "PROJECT_NAME" -- systemctl daemon-reload
sudo incus exec "PROJECT_NAME" -- systemctl enable --now hermes-webui-PROJECT_NAME
```

The per-profile port is `8933` by default (the Hermes agent runtime is on `8932` per the Step 4 config; using `8933` avoids collision). The host's Caddy route `${HERMES_WEBUI_PUBLIC_PATH}PROFILE_NAME/*` proxies to `127.0.0.1:8933` of the instance — Tailscale routes the request to the instance's Tailscale IP.

If you have Caddy running inside the instance and want the per-profile route served there instead, the corresponding Caddyfile snippet is:

```caddyfile
handle /hermes/PROJECT_NAME/* {
    reverse_proxy 127.0.0.1:8933 {
        header_up X-Forwarded-Prefix /hermes/PROJECT_NAME
    }
}
```

## Step 7: Verify

```bash
# Check instance status
sudo incus list "PROJECT_NAME"

# Check Tailscale
sudo incus exec "PROJECT_NAME" -- tailscale status

# Check fzf
sudo incus exec "PROJECT_NAME" -- fzf --version

# Check Hermes
sudo incus exec "PROJECT_NAME" -- systemctl status hermes-gateway-PROJECT_NAME

# Check Hermes Web UI (only if Step 6.5 ran)
sudo incus exec "PROJECT_NAME" -- systemctl status hermes-webui-PROJECT_NAME --no-pager 2>/dev/null \
  || echo "(hermes-webui not installed — that's fine if you skipped Step 6.5)"

# Test 9Router
sudo incus exec "PROJECT_NAME" -- curl -s http://127.0.0.1:11434/v1/models | jq '.data | length'
```

## Next

→ Configure project-specific settings
→ Set up CI/CD if needed
→ Configure monitoring
→ `prompts/tools/30-hermes-webui.md` (host install — runs the per-profile loop if you answered "yes" above)
→ `prompts/tools/30b-fzf.md` (host install — fzf in this instance is already done in Step 2)
