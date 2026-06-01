#!/bin/bash
# CortexOS Incus Project Creator
# Creates a new Incus instance with full AI agent setup

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${BLUE}[i]${NC} $1"; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root (use sudo)"
   exit 1
fi

# Check Incus
if ! command -v incus &> /dev/null; then
    error "Incus not found. Please install Incus first."
    exit 1
fi

# Interactive prompts
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          CortexOS Incus Project Creator                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Project name
read -p "Project name (e.g., myproject): " PROJECT_NAME
if [ -z "$PROJECT_NAME" ]; then
    error "Project name is required"
    exit 1
fi

# Check if instance already exists
if incus info "$PROJECT_NAME" &> /dev/null; then
    error "Instance '$PROJECT_NAME' already exists"
    exit 1
fi

# Base image
info "Available images:"
sudo incus image list --format table
read -p "Base image (default: cortexos-base/latest): " BASE_IMAGE
BASE_IMAGE="${BASE_IMAGE:-cortexos-base:latest}"

# GitHub setup
read -p "GitHub repo (owner/repo, leave empty to skip): " GITHUB_REPO
if [ -n "$GITHUB_REPO" ]; then
    read -p "GitHub token (for private repos): " GITHUB_TOKEN
fi

# Hermes setup
read -p "Setup Hermes AI agent? (yes/no, default: yes): " SETUP_HERMES
SETUP_HERMES="${SETUP_HERMES:-yes}"

# Telegram setup
if [ "$SETUP_HERMES" = "yes" ]; then
    read -p "Setup Telegram bot? (yes/no, default: no): " SETUP_TELEGRAM
    SETUP_TELEGRAM="${SETUP_TELEGRAM:-no}"
    
    if [ "$SETUP_TELEGRAM" = "yes" ]; then
        read -p "Telegram Bot Token: " TELEGRAM_BOT_TOKEN
        read -p "Telegram Chat ID: " TELEGRAM_CHAT_ID
    fi
fi

echo ""
log "Creating project: $PROJECT_NAME"
echo ""

# Step 1: Create Incus Instance
log "[1/7] Creating Incus instance from $BASE_IMAGE..."
sudo incus launch "$BASE_IMAGE" "$PROJECT_NAME" \
  --config raw.lxc="lxc.cgroup.devices.allow = c 10:200 rwm" \
  --config security.nesting=true

sleep 5

# Get instance IP
INSTANCE_IP=$(sudo incus list "$PROJECT_NAME" -c n4 --format csv | cut -d',' -f2 | tr -d ' ')
log "Instance created with IP: ${INSTANCE_IP:-pending}"

# Step 2: Configure SSH
log "[2/7] Configuring SSH..."
sudo incus exec "$PROJECT_NAME" -- mkdir -p /home/cortexos/.ssh

# Copy host SSH keys if they exist
if [ -f ~/.ssh/id_ed25519 ]; then
    sudo incus file push ~/.ssh/id_ed25519 "$PROJECT_NAME"/home/cortexos/.ssh/
    sudo incus file push ~/.ssh/id_ed25519.pub "$PROJECT_NAME"/home/cortexos/.ssh/
fi
if [ -f ~/.ssh/id_rsa ]; then
    sudo incus file push ~/.ssh/id_rsa "$PROJECT_NAME"/home/cortexos/.ssh/
    sudo incus file push ~/.ssh/id_rsa.pub "$PROJECT_NAME"/home/cortexos/.ssh/
fi

sudo incus exec "$PROJECT_NAME" -- chown -R cortexos:cortexos /home/cortexos/.ssh
sudo incus exec "$PROJECT_NAME" -- chmod 700 /home/cortexos/.ssh
sudo incus exec "$PROJECT_NAME" -- chmod 600 /home/cortexos/.ssh/* 2>/dev/null || true

# Step 3: Install Tailscale
log "[3/7] Installing Tailscale..."
sudo incus exec "$PROJECT_NAME" -- curl -fsSL https://tailscale.com/install.sh | sh
sudo incus exec "$PROJECT_NAME" -- systemctl enable --now tailscaled
sleep 2
sudo incus exec "$PROJECT_NAME" -- tailscale up --accept-routes --hostname="$PROJECT_NAME"

# Step 4: GitHub Setup
if [ -n "$GITHUB_REPO" ]; then
    log "[4/7] Setting up GitHub repository..."
    sudo incus exec "$PROJECT_NAME" -- su - cortexos -c "ssh-keyscan github.com >> ~/.ssh/known_hosts 2>/dev/null"
    
    # Create projects directory
    sudo incus exec "$PROJECT_NAME" -- su - cortexos -c "mkdir -p ~/projects"
    
    # Clone repository
    if sudo incus exec "$PROJECT_NAME" -- su - cortexos -c "git clone git@github.com:$GITHUB_REPO.git ~/projects/$PROJECT_NAME 2>/dev/null"; then
        log "Repository cloned successfully"
    else
        warn "Repository clone failed - you may need to add the SSH key to GitHub"
        info "Public key:"
        sudo incus exec "$PROJECT_NAME" -- su - cortexos -c "cat ~/.ssh/id_ed25519.pub 2>/dev/null || cat ~/.ssh/id_rsa.pub 2>/dev/null"
    fi
else
    log "[4/7] Skipping GitHub setup"
fi

# Step 5: Hermes Setup
if [ "$SETUP_HERMES" = "yes" ]; then
    log "[5/7] Setting up Hermes AI agent..."
    
    # Create Hermes profile directory
    sudo incus exec "$PROJECT_NAME" -- mkdir -p "/opt/cortexos/hermes/profiles/$PROJECT_NAME"
    
    # Create Hermes config
    cat > /tmp/hermes-config.yaml <<EOF
profile: $PROJECT_NAME
home: /opt/cortexos/hermes/profiles/$PROJECT_NAME
api:
  host: 127.0.0.1
  port: 8932
  publicPath: /hermes/$PROJECT_NAME/v1
model:
  provider: 9router
  baseUrl: http://127.0.0.1:11434/v1
  id: cc/claude-opus-4-8
  reasoning: true
memory:
  provider: honcho
  baseUrl: http://127.0.0.1:18690
  workspace: $PROJECT_NAME
  aiPeer: hermes-$PROJECT_NAME
EOF

    # Add Telegram config if enabled
    if [ "$SETUP_TELEGRAM" = "yes" ] && [ -n "$TELEGRAM_BOT_TOKEN" ]; then
        log "[6/7] Setting up Telegram bot..."
        cat >> /tmp/hermes-config.yaml <<EOF
telegram:
  token: "$TELEGRAM_BOT_TOKEN"
  allow_from:
    - "$TELEGRAM_CHAT_ID"
  allow_admin_from:
    - "$TELEGRAM_CHAT_ID"
EOF
    fi

    # Push config to instance
    sudo incus file push /tmp/hermes-config.yaml "$PROJECT_NAME"/opt/cortexos/hermes/profiles/$PROJECT_NAME/config.yaml
    sudo incus exec "$PROJECT_NAME" -- chown -R cortexos:cortexos /opt/cortexos/hermes
    
    # Create systemd service
    cat > /tmp/hermes-service.service <<EOF
[Unit]
Description=Hermes Gateway - $PROJECT_NAME
After=network.target

[Service]
Type=simple
User=cortexos
WorkingDirectory=/opt/cortexos/hermes/profiles/$PROJECT_NAME
ExecStart=/usr/local/bin/hermes --profile $PROJECT_NAME
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    sudo incus file push /tmp/hermes-service.service "$PROJECT_NAME"/etc/systemd/system/hermes-gateway-$PROJECT_NAME.service
    sudo incus exec "$PROJECT_NAME" -- systemctl daemon-reload
    sudo incus exec "$PROJECT_NAME" -- systemctl enable hermes-gateway-$PROJECT_NAME
    sudo incus exec "$PROJECT_NAME" -- systemctl start hermes-gateway-$PROJECT_NAME
else
    log "[5/7] Skipping Hermes setup"
fi

# Step 7: Verify
echo ""
log "[7/7] Verifying setup..."
echo ""

echo "=== Instance Status ==="
sudo incus list "$PROJECT_NAME"

echo ""
echo "=== Tailscale Status ==="
sudo incus exec "$PROJECT_NAME" -- tailscale status 2>/dev/null || warn "Tailscale still connecting..."

echo ""
echo "=== Hermes Status ==="
if [ "$SETUP_HERMES" = "yes" ]; then
    sudo incus exec "$PROJECT_NAME" -- systemctl status hermes-gateway-$PROJECT_NAME --no-pager 2>/dev/null || warn "Hermes still starting..."
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          Project $PROJECT_NAME Created!                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
info "Access instance:     sudo incus exec $PROJECT_NAME -- bash"
info "View logs:           sudo incus exec $PROJECT_NAME -- journalctl -f"
info "Tailscale status:    sudo incus exec $PROJECT_NAME -- tailscale status"
if [ "$SETUP_HERMES" = "yes" ]; then
    info "Hermes status:       sudo incus exec $PROJECT_NAME -- systemctl status hermes-gateway-$PROJECT_NAME"
fi
if [ -n "$GITHUB_REPO" ]; then
    info "Project directory:   ~/projects/$PROJECT_NAME"
fi
echo ""
log "Setup complete!"
