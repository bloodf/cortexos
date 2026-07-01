#!/bin/bash
# CortexOS Incus Project Creator
# Creates a new Incus instance with full AI agent setup

set -euo pipefail

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
    read -rsp "GitHub token (for private repos): " GITHUB_TOKEN
    echo
fi

# Hermes setup
read -p "Setup Hermes AI agent? (yes/no, default: yes): " SETUP_HERMES
SETUP_HERMES="${SETUP_HERMES:-yes}"


# Memory OS per-profile setup
if [ "$SETUP_HERMES" = "yes" ]; then
    read -p "Setup Memory OS per-profile? (yes/no, default: no): " SETUP_MEMORY_OS
    SETUP_MEMORY_OS="${SETUP_MEMORY_OS:-no}"
fi

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
log "[1/8] Creating Incus instance from $BASE_IMAGE..."
sudo incus launch "$BASE_IMAGE" "$PROJECT_NAME" \
  --config raw.lxc="lxc.cgroup.devices.allow = c 10:200 rwm" \
  --config security.nesting=true

sleep 5

# Get instance IP
INSTANCE_IP=$(sudo incus list "$PROJECT_NAME" -c n4 --format csv | cut -d',' -f2 | tr -d ' ')
log "Instance created with IP: ${INSTANCE_IP:-pending}"

# Step 2: Configure SSH
log "[2/8] Configuring SSH..."
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
log "[3/8] Installing Tailscale..."
# Download Tailscale installer to a temp file, then run it (don't pipe curl to sh)
TMP_INSTALLER="$(mktemp)"
curl -fsSL https://tailscale.com/install.sh -o "$TMP_INSTALLER"
sh "$TMP_INSTALLER"
rm -f "$TMP_INSTALLER"
sudo incus exec "$PROJECT_NAME" -- systemctl enable --now tailscaled
sleep 2
sudo incus exec "$PROJECT_NAME" -- tailscale up --accept-routes --hostname="$PROJECT_NAME"

# Step 3.5: Install fzf (idempotent — skip if already present)
log "[3.5/8] Installing fzf..."
sudo incus exec "$PROJECT_NAME" -- bash -c "command -v fzf >/dev/null || apt-get install -y -qq fzf"

# Step 4: GitHub Setup
if [ -n "$GITHUB_REPO" ]; then
    log "[4/8] Setting up GitHub repository..."
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
    log "[4/8] Skipping GitHub setup"
fi

# Step 5: Hermes Setup
if [ "$SETUP_HERMES" = "yes" ]; then
    log "[5/8] Setting up Hermes AI agent..."
    
    # Create Hermes profile directory
    sudo incus exec "$PROJECT_NAME" -- mkdir -p ""/opt/cortexos/hermes/profiles/$PROJECT_NAME""
    
    # Create Hermes config in a private temp file
    HERMES_TMP="$(mktemp)"
    chmod 600 "$HERMES_TMP"
    cat > "$HERMES_TMP" <<EOF
profile: $PROJECT_NAME
home: "/opt/cortexos/hermes/profiles/$PROJECT_NAME"
api:
  host: 127.0.0.1
  port: 8932
  publicPath: /hermes/$PROJECT_NAME/v1
model:
  provider: openai
  baseUrl: <<OPENAI_BASE_URL>>
  id: gpt-4o
  reasoning: true
memory:
  provider: honcho
  baseUrl: http://127.0.0.1:18690
  workspace: $PROJECT_NAME
  aiPeer: "hermes-$PROJECT_NAME"
EOF

    # Add Telegram config if enabled
    if [ "$SETUP_TELEGRAM" = "yes" ] && [ -n "$TELEGRAM_BOT_TOKEN" ]; then
        log "[6/8] Setting up Telegram bot..."
        cat >> "$HERMES_TMP" <<EOF
telegram:
  token: "$TELEGRAM_BOT_TOKEN"
  allow_from:
    - "$TELEGRAM_CHAT_ID"
  allow_admin_from:
    - "$TELEGRAM_CHAT_ID"
EOF
    fi

    # Push config to instance
    sudo incus file push "$HERMES_TMP" "$PROJECT_NAME"/opt/cortexos/hermes/profiles/"$PROJECT_NAME"/config.yaml
    rm -f "$HERMES_TMP"
    sudo incus exec "$PROJECT_NAME" -- chown -R cortexos:cortexos /opt/cortexos/hermes

    # Step 5.5: Install shared AI harness skills (idempotent).
    # This wires skills.external_dirs, the codebase-memory-mcp MCP server, and
    # copies skill directories into every agent harness on the instance.
    log "[5.5/8] Installing shared AI harness skills..."
    if sudo incus exec "$PROJECT_NAME" -- test -f /opt/cortexos/scripts/install-ai-harness-skills.sh; then
        sudo incus exec "$PROJECT_NAME" -- su - cortexos -c \
            'cd /opt/cortexos && ./scripts/install-ai-harness-skills.sh'
    else
        warn "CortexOS installer script not found on instance; skipping AI harness skills install"
    fi

    # Create systemd service
    SERVICE_TMP=$(mktemp)
    chmod 600 "$SERVICE_TMP"
    cat > "$SERVICE_TMP" <<EOF
[Unit]
Description=Hermes Gateway - $PROJECT_NAME
After=network.target

[Service]
Type=simple
User=cortexos
WorkingDirectory="/opt/cortexos/hermes/profiles/$PROJECT_NAME"
ExecStart=/usr/local/bin/hermes --profile $PROJECT_NAME
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    sudo incus file push "$SERVICE_TMP" "$PROJECT_NAME"/etc/systemd/system/""hermes-gateway-$PROJECT_NAME".service"
    sudo incus exec "$PROJECT_NAME" -- systemctl daemon-reload
    sudo incus exec "$PROJECT_NAME" -- systemctl enable "hermes-gateway-$PROJECT_NAME"
    sudo incus exec "$PROJECT_NAME" -- systemctl start "hermes-gateway-$PROJECT_NAME"
 else
    log "[5/8] Skipping Hermes setup"
fi


# Step 7.5: Memory OS per-profile setup (consumer side only)
# Wires the host's Memory OS (Qdrant on :6333, Redis on :6379,
# LLM endpoint, Icarus plugin at
# /opt/cortexos/memory-os/.hermes/plugins/icarus) into this
# profile's Hermes runtime. Plugin code is shared via read-only
# bind mount; per-profile data is unique. See
# prompts/tools/60-incus-project.md Step 6.7 for the full
# doc-string; this block is the script-side mirror.
if [ "$SETUP_MEMORY_OS" = "yes" ]; then
    log "[7.5/8] Setting up Memory OS per-profile..."

    # Idempotency: re-running with `yes` already set is a no-op
    # once the per-profile systemd unit is in place.
    if sudo incus exec "$PROJECT_NAME" -- systemctl cat ""cortex-memory-os-$PROJECT_NAME".service" >/dev/null 2>&1; then
        log "    ("cortex-memory-os-$PROJECT_NAME".service already present — skipping step 7.5)"
    else
        # 0. Source the host's Tailscale IP. The canonical location
        #    is /opt/cortexos/host-tailscale-ip.env (created by
        #    13-caddy.md at host-install time, format:
        #    `export CORTEX_HOST_TAILSCALE_IP=100.x.y.z`). If the
        #    file is missing, derive the IP from `tailscale ip -4`
        #    and persist it for next time. Refuse to proceed
        #    without a Tailscale IP — the URLs below point at
        #    host-side services and the container's loopback
        #    (127.0.0.1) is NOT the host's loopback.
        if [ ! -f /opt/cortexos/host-tailscale-ip.env ]; then
            HOST_TS_IP="$(tailscale ip -4 2>/dev/null | head -1 || true)"
            if [ -z "$HOST_TS_IP" ]; then
                error "Tailscale is not up on the host; cannot reach host-side Memory OS."
                error "Install/configure Tailscale on the host first, then re-run this step."
                exit 1
            fi
            sudo install -d -m 0755 /opt/cortexos
            echo "export CORTEX_HOST_TAILSCALE_IP=${HOST_TS_IP}" \
                | sudo tee /opt/cortexos/host-tailscale-ip.env >/dev/null
        fi
        # shellcheck disable=SC1091
        . /opt/cortexos/host-tailscale-ip.env

        # Sanity checks: host Memory OS must be installed.
        if [ ! -f /opt/cortexos/.secrets/memory-os.env ]; then
            error "Host Memory OS not installed (no /opt/cortexos/.secrets/memory-os.env)."
            error "Run prompts/tools/33-hermes-memory-os.md first."
            exit 1
        fi
        if [ ! -d /opt/cortexos/memory-os/.hermes/plugins/icarus ]; then
            error "Host Icarus plugin missing at /opt/cortexos/memory-os/.hermes/plugins/icarus."
            exit 1
        fi

        # 1. Per-profile Memory OS data dir (writable by the Hermes agent user)
        sudo incus exec "$PROJECT_NAME" -- mkdir -p \
            ""/opt/cortexos/hermes/profiles/$PROJECT_NAME"/memory-os/fabric" \
            ""/opt/cortexos/hermes/profiles/$PROJECT_NAME"/memory-os/wiki"
        sudo incus exec "$PROJECT_NAME" -- chown -R cortexos:cortexos \
            ""/opt/cortexos/hermes/profiles/$PROJECT_NAME"/memory-os"

        # 2. Bind-mount the host's Icarus plugin into the per-profile
        #    plugin dir. Use `add` only if the device is missing (a
        #    failed prior run would leave the device in place).
        if ! sudo incus config device show "$PROJECT_NAME" \
            | grep -q '^memory-os-icarus:'; then
            sudo incus config device add "$PROJECT_NAME" memory-os-icarus \
                disk source=/opt/cortexos/memory-os/.hermes/plugins/icarus \
                path=""/opt/cortexos/hermes/profiles/$PROJECT_NAME"/plugins/icarus" \
                readonly=true
        fi

        # 3. Per-profile env file (re-shares the host's LLM API key
        #    and Redis password; same pattern as 32-honcho.md). The
        #    URLs point at the host's tailnet IP, NOT 127.0.0.1.
        LLM_API_KEY_VAL="$(sudo grep '^LLM_API_KEY=' /opt/cortexos/.secrets/memory-os.env | cut -d= -f2-)"
        LLM_BASE_URL_VAL="$(sudo grep '^ICARUS_ENDPOINT=' /opt/cortexos/.secrets/memory-os.env | cut -d= -f2- | sed 's|/chat/completions||')"
        REDIS_PASSWORD_VAL="$(sudo grep '^REDIS_PASSWORD=' /opt/cortexos/.secrets/memory-os.env | cut -d= -f2-)"

        cat > "/tmp/memory-os-$PROJECT_NAME.env" <<EOF
# LLM endpoint (host-side, via tailnet)
LLM_API_KEY=${LLM_API_KEY_VAL}
ICARUS_ENDPOINT=${LLM_BASE_URL_VAL}/chat/completions
ICARUS_API_KEY_ENV=LLM_API_KEY
ICARUS_EXTRACTION_MODEL=gpt-4o-mini
ICARUS_EXTRACTION_MAX_TOKENS=4096

# Qdrant + Redis (host-side, via tailnet)
QDRANT_URL=http://${CORTEX_HOST_TAILSCALE_IP}:6333
QDRANT_API_KEY=
REDIS_URL=redis://${CORTEX_HOST_TAILSCALE_IP}:6379
REDIS_PASSWORD=${REDIS_PASSWORD_VAL}

# Per-profile paths (unique to this profile)
HERMES_HOME="/opt/cortexos/hermes/profiles/$PROJECT_NAME"
FABRIC_DIR="/opt/cortexos/hermes/profiles/$PROJECT_NAME"/memory-os/fabric
STATE_DB_PATH="/opt/cortexos/hermes/profiles/$PROJECT_NAME"/memory-os/state.db
WIKI_ROOT="/opt/cortexos/hermes/profiles/$PROJECT_NAME"/memory-os/wiki
VAULT_PATH="/opt/cortexos/hermes/profiles/$PROJECT_NAME"/memory-os/wiki
EOF
        sudo incus file push "/tmp/memory-os-$PROJECT_NAME.env" \
            "$PROJECT_NAME/opt/cortexos/memory-os-$PROJECT_NAME.env"
        sudo incus exec "$PROJECT_NAME" -- chmod 0600 "/opt/cortexos/memory-os-$PROJECT_NAME.env"
        sudo incus exec "$PROJECT_NAME" -- chown cortexos:cortexos "/opt/cortexos/memory-os-$PROJECT_NAME.env"
        rm -f "/tmp/memory-os-$PROJECT_NAME.env"

        # 4. Per-profile systemd unit. Hermes is the runtime that
        #    loads the Icarus plugin; we don't need a separate
        #    long-running "memory-os" service per profile. The unit
        #    below is a no-op oneshot that exists for two reasons:
        #    (a) it gives `systemctl status` a real surface to
        #    confirm the env file is present + readable, and (b)
        #    `EnvironmentFile` propagates the vars to anything else
        #    started by the same unit (e.g. a future wiki-curator
        #    timer).
        cat > "/tmp/"cortex-memory-os-$PROJECT_NAME".service" <<EOF
[Unit]
Description=Memory OS per-profile ($PROJECT_NAME) — Icarus plugin env shim
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=cortexos
EnvironmentFile=/opt/cortexos/memory-os-$PROJECT_NAME.env
ExecStart=/bin/true
ExecStop=/bin/true

[Install]
WantedBy=multi-user.target
EOF
        sudo incus file push "/tmp/"cortex-memory-os-$PROJECT_NAME".service" \
            "$PROJECT_NAME/etc/systemd/system/"cortex-memory-os-$PROJECT_NAME".service"
        rm -f "/tmp/"cortex-memory-os-$PROJECT_NAME".service"

        sudo incus exec "$PROJECT_NAME" -- systemctl daemon-reload
        sudo incus exec "$PROJECT_NAME" -- systemctl enable --now ""cortex-memory-os-$PROJECT_NAME""

        # 5. Append the `memory-os:` block to the per-profile
        #    config.yaml. Guard against double-append on a
        #    partially-failed prior run.
        if ! sudo incus exec "$PROJECT_NAME" -- grep -q '^memory-os:' \
            ""/opt/cortexos/hermes/profiles/$PROJECT_NAME"/config.yaml"; then
            cat > "/tmp/memory-os-config-$PROJECT_NAME.yaml" <<EOF

memory-os:
  enabled: true
  envFile: /opt/cortexos/memory-os-$PROJECT_NAME.env
  pluginPath: "/opt/cortexos/hermes/profiles/$PROJECT_NAME"/plugins/icarus
  fabricDir: "/opt/cortexos/hermes/profiles/$PROJECT_NAME"/memory-os/fabric
  stateDbPath: "/opt/cortexos/hermes/profiles/$PROJECT_NAME"/memory-os/state.db
  wikiRoot: "/opt/cortexos/hermes/profiles/$PROJECT_NAME"/memory-os/wiki
  qdrantUrl: http://${CORTEX_HOST_TAILSCALE_IP}:6333
  redisUrl: redis://${CORTEX_HOST_TAILSCALE_IP}:6379
EOF
            sudo incus file push "/tmp/memory-os-config-$PROJECT_NAME.yaml" \
                "$PROJECT_NAME/tmp/memory-os-config-$PROJECT_NAME.yaml"
            sudo incus exec "$PROJECT_NAME" -- bash -c \
                "cat /tmp/memory-os-config-$PROJECT_NAME.yaml >> "/opt/cortexos/hermes/profiles/$PROJECT_NAME"/config.yaml"
            sudo incus exec "$PROJECT_NAME" -- rm -f "/tmp/memory-os-config-$PROJECT_NAME.yaml"
            rm -f "/tmp/memory-os-config-$PROJECT_NAME.yaml"
        fi

        # 6. Restart Hermes so the Icarus plugin gets
        #    re-discovered on the next profile reload. Hermes reads
        #    plugins/ at startup.
        sudo incus exec "$PROJECT_NAME" -- systemctl restart ""hermes-gateway-$PROJECT_NAME""

        log "    Memory OS per-profile configured (Qdrant + Redis + Icarus via tailnet)"
    fi
else
    log "[7.5/8] Skipping Memory OS per-profile setup"
fi

# Step 8: Verify
echo ""
log "[8/8] Verifying setup..."
echo ""

echo "=== Instance Status ==="
sudo incus list "$PROJECT_NAME"

echo ""
echo "=== Tailscale Status ==="
sudo incus exec "$PROJECT_NAME" -- tailscale status 2>/dev/null || warn "Tailscale still connecting..."

echo ""
echo "=== fzf Version ==="
sudo incus exec "$PROJECT_NAME" -- fzf --version 2>/dev/null || warn "fzf not installed"

echo ""
echo "=== Hermes Status ==="
if [ "$SETUP_HERMES" = "yes" ]; then
    sudo incus exec "$PROJECT_NAME" -- systemctl status "hermes-gateway-$PROJECT_NAME" --no-pager 2>/dev/null || warn "Hermes still starting..."
fi

echo ""
echo "=== Memory OS per-profile Status ==="
if [ "$SETUP_MEMORY_OS" = "yes" ]; then
    sudo incus exec "$PROJECT_NAME" -- systemctl status "cortex-memory-os-$PROJECT_NAME" --no-pager 2>/dev/null || warn "Memory OS per-profile still starting..."
    # Confirm the Icarus plugin is visible inside the instance via the bind mount
    sudo incus exec "$PROJECT_NAME" -- ls -la ""/opt/cortexos/hermes/profiles/$PROJECT_NAME"/plugins/icarus" 2>/dev/null | head -3 \
      || warn "Icarus plugin bind mount not visible — check `incus config device show $PROJECT_NAME`"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          Project $PROJECT_NAME Created!                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
info "Access instance:     sudo incus exec $PROJECT_NAME -- bash"
info "View logs:           sudo incus exec $PROJECT_NAME -- journalctl -f"
info "Tailscale status:    sudo incus exec $PROJECT_NAME -- tailscale status"
info "fzf version:         sudo incus exec $PROJECT_NAME -- fzf --version"
if [ "$SETUP_HERMES" = "yes" ]; then
    info "Hermes status:       sudo incus exec $PROJECT_NAME -- systemctl status "hermes-gateway-$PROJECT_NAME""
fi
if [ "$SETUP_MEMORY_OS" = "yes" ]; then
    info "Memory OS profile:   sudo incus exec $PROJECT_NAME -- systemctl status "cortex-memory-os-$PROJECT_NAME""
    info "Icarus plugin:       sudo incus exec $PROJECT_NAME -- ls "/opt/cortexos/hermes/profiles/$PROJECT_NAME"/plugins/icarus"
fi
if [ -n "$GITHUB_REPO" ]; then
    info "Project directory:   ~/projects/$PROJECT_NAME"
fi
echo ""
log "Setup complete!"
