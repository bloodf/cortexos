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
**Memory OS per-profile:** (yes/no) — only relevant if the host has Memory OS installed and you want a per-profile Icarus plugin + wiki on this instance. The plugin code is shared (read-only mount from the host); only the per-profile data is unique. See `prompts/tools/33-hermes-memory-os.md` Ask User block. Default: no (opt-in — the 7-layer stack has a footprint the operator may not want per-profile).
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
  memory_enabled: true
  provider: hindsight
hindsight:
  config_path: /opt/cortexos/hermes/profiles/PROJECT_NAME/hindsight-config.json
  auto_recall: true
  auto_retain: true
EOF
```

## Step 4.5: Install Shared AI Harness Skills (Automatic)

`scripts/incus-create-project.sh` runs `scripts/install-ai-harness-skills.sh`
automatically after the Hermes profile is created. This installs the shared
skill/prompt libraries (codebase-memory-mcp, superpowers, mattpocock/skills,
prompt-master, stop-slop) into the instance's Hermes profile and every other
agent harness on the instance. No operator action is required.

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

### Optional: Memory OS wiki Caddy route

If you answered `yes` to "Memory OS per-profile" and want the
per-profile wiki exposed (read-only webui for the Icarus-fabricated
markdown), add this Caddy block (the `/hermes/PROJECT_NAME/memory/*`
prefix must come BEFORE any more general `/hermes/PROJECT_NAME/*`
matcher or it will be eaten by the reverse_proxy):

```caddyfile
# handle_path (NOT handle) — strips the /hermes/PROJECT_NAME/memory/
# prefix so file_server looks up the file at
# /opt/cortexos/hermes/profiles/PROJECT_NAME/memory-os/wiki/<rest>,
# not wiki/hermes/PROJECT_NAME/memory/<rest>. Without the strip, every
# wiki URL 404s.
handle_path /hermes/PROJECT_NAME/memory/* {
    root * /opt/cortexos/hermes/profiles/PROJECT_NAME/memory-os/wiki
    file_server
}
```

The wiki is plain markdown + frontmatter — a `file_server` is sufficient
and safer than reverse-proxying the upstream, because there is no
dynamic handler to misconfigure. Step 6.7 below is what creates the
wiki dir + Icarus plugin mount that this route serves.

## Step 6.7: Per-profile Memory OS (Optional)

The per-profile Memory OS layer wires the **host's** Memory OS stack
(Qdrant on `:6333`, Redis on `:6379`, 9Router on `:11434`, Icarus
plugin at `/opt/cortexos/memory-os/.hermes/plugins/icarus`) into this
profile's Hermes runtime. The plugin code is **shared** (read-only
bind mount from the host); only the per-profile data
(`FABRIC_DIR`, `STATE_DB_PATH`, `WIKI_ROOT`) is unique. The host-side
install is in `prompts/tools/33-hermes-memory-os.md`. This step does
**not** install a new Memory OS instance — it just configures the
consumer side that runs inside the Incus instance.

Skip this step if any of the following is true:

- You answered `no` to "Memory OS per-profile" above.
- The host does not have Memory OS installed (no
  `/opt/cortexos/.secrets/memory-os.env` on the host).
- The systemd unit `cortex-memory-os-PROJECT_NAME.service` already
  exists inside the instance (idempotency: re-running with `yes` set
  is a no-op once the unit is in place).

```bash
# Idempotency guard: if the systemd unit already exists inside the
# instance, this step is a no-op. The unit is the single source of
# truth for "Step 6.7 ran for this profile"; everything else (env
# file, bind mount, config.yaml block) is derived from it.
if sudo incus exec "PROJECT_NAME" -- systemctl cat cortex-memory-os-PROJECT_NAME.service >/dev/null 2>&1; then
  echo "(cortex-memory-os-PROJECT_NAME.service already present — Step 6.7 is a no-op for this profile)"
else
  # 0. Source the host's Tailscale IP. The canonical location is
  #    /opt/cortexos/host-tailscale-ip.env (created by 13-caddy.md at
  #    host-install time, format: `export CORTEX_HOST_TAILSCALE_IP=100.x.y.z`).
  #    If the file is missing, derive the IP from `tailscale ip -4` and
  #    persist it for next time. Refuse to proceed without a Tailscale
  #    IP — the URLs below point at host-side services and the
  #    container's loopback (127.0.0.1) is NOT the host's loopback.
  if [ ! -f /opt/cortexos/host-tailscale-ip.env ]; then
    HOST_TS_IP="$(tailscale ip -4 2>/dev/null | head -1 || true)"
    if [ -z "${HOST_TS_IP}" ]; then
      echo "ERROR: Tailscale is not up on the host; cannot reach host-side Memory OS." >&2
      echo "       Install/configure Tailscale on the host first, then re-run this step." >&2
      exit 1
    fi
    sudo install -d -m 0755 /opt/cortexos
    echo "export CORTEX_HOST_TAILSCALE_IP=${HOST_TS_IP}" \
      | sudo tee /opt/cortexos/host-tailscale-ip.env >/dev/null
  fi
  . /opt/cortexos/host-tailscale-ip.env

  # Sanity check: the host's Memory OS secrets must exist.
  test -f /opt/cortexos/.secrets/memory-os.env \
    || { echo "ERROR: host Memory OS not installed (no /opt/cortexos/.secrets/memory-os.env). Run 33-hermes-memory-os.md first." >&2; exit 1; }

  # Sanity check: the host's Icarus plugin must exist.
  test -d /opt/cortexos/memory-os/.hermes/plugins/icarus \
    || { echo "ERROR: host Icarus plugin missing at /opt/cortexos/memory-os/.hermes/plugins/icarus." >&2; exit 1; }

  # 1. Per-profile Memory OS data dir (writable by the Hermes agent user)
  sudo incus exec "PROJECT_NAME" -- mkdir -p \
    /opt/cortexos/hermes/profiles/PROJECT_NAME/memory-os/fabric \
    /opt/cortexos/hermes/profiles/PROJECT_NAME/memory-os/wiki
  sudo incus exec "PROJECT_NAME" -- chown -R cortexos:cortexos \
    /opt/cortexos/hermes/profiles/PROJECT_NAME/memory-os

  # 2. Bind-mount the host's Icarus plugin into the per-profile plugin dir.
  #    A bind mount (not a copy) keeps a single host-side plugin update
  #    propagating to every profile automatically; the per-profile
  #    STATE_DB_PATH / FABRIC_DIR keep profiles isolated from each other.
  #    `config device add` would fail with "Device already exists" on a
  #    re-run after a partially-failed prior attempt, so use `add` only
  #    if the device is missing.
  if ! sudo incus config device show "PROJECT_NAME" \
      | grep -q '^memory-os-icarus:'; then
    sudo incus config device add "PROJECT_NAME" memory-os-icarus \
      disk source=/opt/cortexos/memory-os/.hermes/plugins/icarus \
      path=/opt/cortexos/hermes/profiles/PROJECT_NAME/plugins/icarus \
      readonly=true
  fi

  # 3. Per-profile env file. The Icarus plugin reads ICARUS_ENDPOINT /
  #    ICARUS_API_KEY_ENV / FABRIC_DIR / HERMES_HOME from this file when
  #    Hermes starts. All URLs point at the host's tailnet IP — the
  #    container cannot reach the host's loopback (127.0.0.1 inside the
  #    container is the container's own loopback). The 9router key and
  #    Redis password are RE-SHARED from the host's secrets file (same
  #    pattern as 32-honcho.md).
  NINEROUTER_API_KEY_VAL="$(sudo grep ^NINEROUTER_API_KEY= /opt/cortexos/.secrets/memory-os.env | cut -d= -f2-)"
  REDIS_PASSWORD_VAL="$(sudo grep ^REDIS_PASSWORD= /opt/cortexos/.secrets/memory-os.env | cut -d= -f2-)"

  sudo incus exec "PROJECT_NAME" -- tee /opt/cortexos/memory-os-PROJECT_NAME.env >/dev/null <<EOF
  # 9router (host-side, via tailnet)
  NINEROUTER_API_KEY=${NINEROUTER_API_KEY_VAL}
  ICARUS_ENDPOINT=http://${CORTEX_HOST_TAILSCALE_IP}:11434/v1/chat/completions
  ICARUS_API_KEY_ENV=NINEROUTER_API_KEY
  ICARUS_EXTRACTION_MODEL=cx/gpt-5.5
  ICARUS_EXTRACTION_MAX_TOKENS=4096

  # Qdrant + Redis (host-side, via tailnet)
  QDRANT_URL=http://${CORTEX_HOST_TAILSCALE_IP}:6333
  QDRANT_API_KEY=
  REDIS_URL=redis://${CORTEX_HOST_TAILSCALE_IP}:6379
  REDIS_PASSWORD=${REDIS_PASSWORD_VAL}

  # Per-profile paths (unique to this profile)
  HERMES_HOME=/opt/cortexos/hermes/profiles/PROJECT_NAME
  FABRIC_DIR=/opt/cortexos/hermes/profiles/PROJECT_NAME/memory-os/fabric
  STATE_DB_PATH=/opt/cortexos/hermes/profiles/PROJECT_NAME/memory-os/state.db
  WIKI_ROOT=/opt/cortexos/hermes/profiles/PROJECT_NAME/memory-os/wiki
  VAULT_PATH=/opt/cortexos/hermes/profiles/PROJECT_NAME/memory-os/wiki
EOF

  sudo incus exec "PROJECT_NAME" -- chmod 0600 /opt/cortexos/memory-os-PROJECT_NAME.env
  sudo incus exec "PROJECT_NAME" -- chown cortexos:cortexos /opt/cortexos/memory-os-PROJECT_NAME.env

  # 4. Per-profile systemd unit. Hermes is the runtime that loads the
  #    Icarus plugin; we don't need a separate long-running "memory-os"
  #    service per profile. The unit below is a no-op oneshot that
  #    exists for two reasons: (a) it gives `systemctl status` a real
  #    surface to confirm the env file is present + readable, and (b)
  #    `EnvironmentFile` propagates the vars to anything else started
  #    by the same unit (e.g. a future wiki-curator timer).
  sudo incus exec "PROJECT_NAME" -- tee /etc/systemd/system/cortex-memory-os-PROJECT_NAME.service >/dev/null <<EOF
[Unit]
Description=Memory OS per-profile (PROJECT_NAME) — Icarus plugin env shim
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=cortexos
EnvironmentFile=/opt/cortexos/memory-os-PROJECT_NAME.env
ExecStart=/bin/true
ExecStop=/bin/true

[Install]
WantedBy=multi-user.target
EOF

  sudo incus exec "PROJECT_NAME" -- systemctl daemon-reload
  sudo incus exec "PROJECT_NAME" -- systemctl enable --now cortex-memory-os-PROJECT_NAME

  # 5. Append the `memory-os:` block to the per-profile config.yaml so
  #    the Hermes Agent picks up the Icarus plugin on next reload.
  #    Guard against double-append on a partially-failed prior run.
  if ! sudo incus exec "PROJECT_NAME" -- grep -q '^memory-os:' \
      /opt/cortexos/hermes/profiles/PROJECT_NAME/config.yaml; then
    sudo incus exec "PROJECT_NAME" -- tee -a /opt/cortexos/hermes/profiles/PROJECT_NAME/config.yaml >/dev/null <<EOF
memory-os:
  enabled: true
  envFile: /opt/cortexos/memory-os-PROJECT_NAME.env
  pluginPath: /opt/cortexos/hermes/profiles/PROJECT_NAME/plugins/icarus
  fabricDir: /opt/cortexos/hermes/profiles/PROJECT_NAME/memory-os/fabric
  stateDbPath: /opt/cortexos/hermes/profiles/PROJECT_NAME/memory-os/state.db
  wikiRoot: /opt/cortexos/hermes/profiles/PROJECT_NAME/memory-os/wiki
  qdrantUrl: http://${CORTEX_HOST_TAILSCALE_IP}:6333
  redisUrl: redis://${CORTEX_HOST_TAILSCALE_IP}:6379
EOF
  fi

  # 6. Restart Hermes so the Icarus plugin gets re-discovered on the
  #    next profile reload. Hermes reads plugins/ at startup.
  sudo incus exec "PROJECT_NAME" -- systemctl restart hermes-gateway-PROJECT_NAME
fi
```

The per-profile wiki (read-only webui) is exposed via Caddy at
`/hermes/PROJECT_NAME/memory/*` — the Caddyfile block lives in the
"Optional: Memory OS wiki Caddy route" section above (the `handle_path
/hermes/PROJECT_NAME/memory/*` block). It is plain markdown, so a
`file_server` is sufficient and safer than a reverse_proxy.

If Memory OS is enabled, the Caddy route must be added BEFORE the more
general `/hermes/PROJECT_NAME/*` matcher in the instance's Caddyfile,
or the reverse_proxy will eat the path. Re-order if the existing
snippet is already in place.

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

# Check Memory OS per-profile (only if Step 6.7 ran)
sudo incus exec "PROJECT_NAME" -- systemctl status cortex-memory-os-PROJECT_NAME --no-pager 2>/dev/null \
  || echo "(memory-os per-profile not installed — that's fine if you skipped Step 6.7)"

# Confirm the Icarus plugin is visible inside the instance via the bind mount
sudo incus exec "PROJECT_NAME" -- ls -la /opt/cortexos/hermes/profiles/PROJECT_NAME/plugins/icarus | head -5

# Test 9Router
sudo incus exec "PROJECT_NAME" -- curl -s http://127.0.0.1:11434/v1/models | jq '.data | length'
```

## Next

→ Configure project-specific settings
→ Set up CI/CD if needed
→ Configure monitoring
→ `prompts/tools/30b-fzf.md` (host install — fzf in this instance is already done in Step 2)
→ `prompts/tools/33-hermes-memory-os.md` (host install — the per-profile Memory OS loop above assumes the host install ran first; the Caddy route at `/hermes/PROJECT_NAME/memory/*` only works after this)
