---
name: incus-project-create
description: Create a new Incus container instance for a project with AI agent setup, GitHub integration, Hermes profile, and Tailscale VPN.
source: auto-skill
extracted_at: '2026-06-01T02:35:00.000Z'
---

# Incus Project Creation Skill

## What this skill does
1. Creates a new Incus container from base image
2. Sets up GitHub access (SSH key + repo clone/create)
3. Configures Tailscale VPN
4. Creates Hermes AI agent profile
5. Optionally sets up Telegram bot integration

## Usage
Invoke with: `/incus-project-create`

## Parameters
- `PROJECT_NAME` - Name for the project/instance
- `BASE_IMAGE` - Base image (cortexos-base or cortexos-gastown-base)
- `GITHUB_REPO` - GitHub repository (owner/repo format)
- `GITHUB_TOKEN` - GitHub personal access token
- `SETUP_HERMES` - Whether to setup Hermes (yes/no)
- `SETUP_TELEGRAM` - Whether to setup Telegram (yes/no)
- `TELEGRAM_BOT_TOKEN` - Telegram bot token (if enabled)
- `TELEGRAM_CHAT_ID` - Telegram allowed chat ID (if enabled)

## Execution

```bash
#!/bin/bash
set -e

# Get parameters from user or environment
PROJECT_NAME="${1:-newproject}"
BASE_IMAGE="${2:-cortexos-base:latest}"
GITHUB_REPO="${3:-}"
GITHUB_TOKEN="${4:-}"
SETUP_HERMES="${5:-yes}"
SETUP_TELEGRAM="${6:-no}"
TELEGRAM_BOT_TOKEN="${7:-}"
TELEGRAM_CHAT_ID="${8:-}"

echo "=== Creating Incus Project: ${PROJECT_NAME} ==="

# Step 1: Create Incus Instance
echo "[1/7] Creating Incus instance..."
sudo incus launch "${BASE_IMAGE}" "${PROJECT_NAME}" \
  --config raw.lxc="lxc.cgroup.devices.allow = c 10:200 rwm" \
  --config security.nesting=true

sleep 5

# Get instance info
INSTANCE_IP=$(sudo incus list "${PROJECT_NAME}" -c n4 --format csv | cut -d',' -f2 | tr -d ' ')
echo "Instance IP: ${INSTANCE_IP}"

# Step 2: Configure SSH
echo "[2/7] Configuring SSH..."
sudo incus exec "${PROJECT_NAME}" -- mkdir -p /home/cortexos/.ssh
sudo incus file push ~/.ssh/id_ed25519 "${PROJECT_NAME}"/home/cortexos/.ssh/ 2>/dev/null || true
sudo incus file push ~/.ssh/id_ed25519.pub "${PROJECT_NAME}"/home/cortexos/.ssh/ 2>/dev/null || true
sudo incus exec "${PROJECT_NAME}" -- chown -R cortexos:cortexos /home/cortexos/.ssh
sudo incus exec "${PROJECT_NAME}" -- chmod 700 /home/cortexos/.ssh
sudo incus exec "${PROJECT_NAME}" -- chmod 600 /home/cortexos/.ssh/id_ed25519 2>/dev/null || true

# Step 3: Install and configure Tailscale
echo "[3/7] Configuring Tailscale..."
sudo incus exec "${PROJECT_NAME}" -- curl -fsSL https://tailscale.com/install.sh | sh
sudo incus exec "${PROJECT_NAME}" -- systemctl enable --now tailscaled
sleep 2
sudo incus exec "${PROJECT_NAME}" -- tailscale up --accept-routes --hostname="${PROJECT_NAME}"

# Step 4: GitHub Setup
echo "[4/7] Setting up GitHub..."
if [ -n "${GITHUB_REPO}" ]; then
    # Add GitHub to known_hosts
    sudo incus exec "${PROJECT_NAME}" -- su - cortexos -c "ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null"
    
    # Clone repository
    sudo incus exec "${PROJECT_NAME}" -- su - cortexos -c "git clone git@github.com:${GITHUB_REPO}.git ~/projects/${PROJECT_NAME} 2>/dev/null || echo 'Repo clone failed - may need to add SSH key to GitHub'"
fi

# Step 5: Hermes Setup
echo "[5/7] Setting up Hermes..."
if [ "${SETUP_HERMES}" = "yes" ]; then
    # Create Hermes profile directory
    sudo incus exec "${PROJECT_NAME}" -- mkdir -p "/opt/cortexos/hermes/profiles/${PROJECT_NAME}"
    
    # Create Hermes config
    sudo incus exec "${PROJECT_NAME}" -- tee "/opt/cortexos/hermes/profiles/${PROJECT_NAME}/config.yaml" > /dev/null <<EOF
profile: ${PROJECT_NAME}
home: /opt/cortexos/hermes/profiles/${PROJECT_NAME}
api:
  host: 127.0.0.1
  port: 8932
  publicPath: /hermes/${PROJECT_NAME}/v1
model:
  provider: 9router
  baseUrl: http://127.0.0.1:11434/v1
  id: cc/claude-opus-4-8
  reasoning: true
memory:
  provider: honcho
  baseUrl: http://127.0.0.1:18690
  workspace: ${PROJECT_NAME}
  aiPeer: hermes-${PROJECT_NAME}
EOF

    # Step 6: Telegram Setup (Optional)
    if [ "${SETUP_TELEGRAM}" = "yes" ] && [ -n "${TELEGRAM_BOT_TOKEN}" ]; then
        echo "[6/7] Setting up Telegram..."
        sudo incus exec "${PROJECT_NAME}" -- tee -a "/opt/cortexos/hermes/profiles/${PROJECT_NAME}/config.yaml" > /dev/null <<EOF
telegram:
  token: "${TELEGRAM_BOT_TOKEN}"
  allow_from:
    - "${TELEGRAM_CHAT_ID}"
  allow_admin_from:
    - "${TELEGRAM_CHAT_ID}"
EOF
    fi

    # Create systemd service for Hermes
    sudo incus exec "${PROJECT_NAME}" -- tee "/etc/systemd/system/hermes-gateway-${PROJECT_NAME}.service" > /dev/null <<EOF
[Unit]
Description=Hermes Gateway - ${PROJECT_NAME}
After=network.target

[Service]
Type=simple
User=cortexos
WorkingDirectory=/opt/cortexos/hermes/profiles/${PROJECT_NAME}
ExecStart=/usr/local/bin/hermes --profile ${PROJECT_NAME}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    # Enable and start Hermes
    sudo incus exec "${PROJECT_NAME}" -- systemctl daemon-reload
    sudo incus exec "${PROJECT_NAME}" -- systemctl enable "hermes-gateway-${PROJECT_NAME}"
    sudo incus exec "${PROJECT_NAME}" -- systemctl start "hermes-gateway-${PROJECT_NAME}"
fi

# Step 7: Verify
echo "[7/7] Verifying setup..."
echo ""
echo "=== Instance Status ==="
sudo incus list "${PROJECT_NAME}"

echo ""
echo "=== Tailscale Status ==="
sudo incus exec "${PROJECT_NAME}" -- tailscale status 2>/dev/null || echo "Tailscale not ready yet"

echo ""
echo "=== Hermes Status ==="
if [ "${SETUP_HERMES}" = "yes" ]; then
    sudo incus exec "${PROJECT_NAME}" -- systemctl status "hermes-gateway-${PROJECT_NAME}" --no-pager 2>/dev/null || echo "Hermes not ready yet"
fi

echo ""
echo "=== Project ${PROJECT_NAME} Created ==="
echo "Access: sudo incus exec ${PROJECT_NAME} -- bash"
echo "Tailscale: sudo incus exec ${PROJECT_NAME} -- tailscale status"
if [ "${SETUP_HERMES}" = "yes" ]; then
    echo "Hermes: sudo incus exec ${PROJECT_NAME} -- systemctl status hermes-gateway-${PROJECT_NAME}"
fi
```

## Interactive Mode

If run without parameters, the script will prompt for:
1. Project name
2. Base image selection
3. GitHub repository (optional)
4. Hermes setup (yes/no)
5. Telegram setup (yes/no)

## Notes
- Instance must have internet access for Tailscale and GitHub
- SSH key must be added to GitHub for repository access
- Hermes binary must be available in /usr/local/bin/hermes
- 9Router must be accessible from the instance
