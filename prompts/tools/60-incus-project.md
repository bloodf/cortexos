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

## Step 7: Verify

```bash
# Check instance status
sudo incus list "PROJECT_NAME"

# Check Tailscale
sudo incus exec "PROJECT_NAME" -- tailscale status

# Check Hermes
sudo incus exec "PROJECT_NAME" -- systemctl status hermes-gateway-PROJECT_NAME

# Test 9Router
sudo incus exec "PROJECT_NAME" -- curl -s http://127.0.0.1:11434/v1/models | jq '.data | length'
```

## Next

→ Configure project-specific settings
→ Set up CI/CD if needed
→ Configure monitoring
