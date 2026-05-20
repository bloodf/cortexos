# OpenClaw (latest)

## Purpose

Install OpenClaw, repair the local config schema for the current runtime, and
boot one canonical gateway on `:18789`. CortexOS uses this single OpenClaw
instance as the source of truth for agents, projects, Telegram, Paperclip, and
operator web access.

## Prerequisites

- `31-9router.md` completed.
- `32-openviking.md` completed.
- Node.js ≥ 20 installed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

```bash
sudo -v
```

## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Configure single-source gateway + 9Router model
- [ ] Configure optional Telegram main agent token
- [ ] Configure LAN socket proxies for OpenClaw Web UI
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Node.js ≥ 20 is installed and 9Router is running?

Type `confirmed` to proceed.

## Install

```bash
npm install -g openclaw@latest
openclaw --version
```

## Configure

Seed a minimal config, then let current OpenClaw normalize schema drift with `openclaw doctor --fix`.

```bash
set -a
source /opt/cortexos/.secrets/9router.env
set +a

mkdir -p ~/.openclaw ~/.openclaw/roles
python3 - <<'PY'
from pathlib import Path
import json, os
cfg = {
  'account': 'cortex',
  'gatewayUrl': 'http://127.0.0.1:18789',
  'aiProvider': {
    'baseUrl': 'http://127.0.0.1:11434/v1',
    'apiKey': os.environ['NINEROUTER_API_KEY'],
  },
  'memory': {
    'backend': 'openviking',
    'url': 'http://127.0.0.1:18790',
  },
  'channels': [],
}
p = Path.home()/'.openclaw/openclaw.json'
p.write_text(json.dumps(cfg, indent=2)+'\n')
p.chmod(0o600)
PY
cp templates/openclaw/roles/cortex.json ~/.openclaw/roles/cortex.json
openclaw doctor --fix || true
```

Install the gateway unit and substitute placeholders. Current runtimes are most reliable with `--allow-unconfigured` on the gateway process.

```bash
NODE_BIN=$(command -v node)
NODE_BIN_DIR=$(dirname "$NODE_BIN")
NPM_PREFIX=$(npm prefix -g)
python3 - <<PY >/tmp/openclaw-gateway.service
from pathlib import Path
s = Path('templates/systemd/openclaw-gateway.service').read_text()
s = s.replace('{VPS_USER}', 'cortexos').replace('{VPS_HOME}', '/home/cortexos').replace('{NODE_BIN}', '$NODE_BIN').replace('{NODE_BIN_DIR}', '$NODE_BIN_DIR').replace('{NPM_PREFIX}', '$NPM_PREFIX')
s = s.replace('gateway --port 18789', 'gateway --port 18789 --allow-unconfigured')
print(s, end='')
PY
cat >/tmp/openclaw-gateway.env <<EOF
NINEROUTER_BASE_URL=http://127.0.0.1:11434
NINEROUTER_API_KEY=${NINEROUTER_API_KEY}
OPENVIKING_URL=http://127.0.0.1:18790
# Optional: paste the BotFather token here when Telegram should be the
# VPS main agent channel. Keep this file mode 0600; never commit tokens.
# TELEGRAM_BOT_TOKEN=
EOF
sudo install -m 0600 -o cortexos -g cortexos /tmp/openclaw-gateway.env /opt/cortexos/.secrets/openclaw-gateway.env
sudo install -m 0644 /tmp/openclaw-gateway.service /etc/systemd/system/openclaw-gateway.service
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-gateway
```

Apply the production CortexOS OpenClaw policy. This keeps the gateway bound to
loopback so Tailscale Serve can own the tailnet listener on the same port, while
the LAN socket proxies below expose the same single Web UI to local-network
browsers. `execApprovals.enabled=false` is intentional for the trusted VPS main
agent; do not split projects into multiple OpenClaw instances.

```bash
cat >/tmp/openclaw-cortexos-policy.json5 <<'JSON'
{
  secrets: {
    providers: {
      default: { source: "env" }
    }
  },
  gateway: {
    bind: "loopback",
    auth: { allowTailscale: true },
    controlUi: { dangerouslyAllowHostHeaderOriginFallback: true }
  },
  tools: {
    profile: "full",
    alsoAllow: ["message", "group:messaging"]
  },
  browser: {
    ssrfPolicy: {
      dangerouslyAllowPrivateNetwork: true,
      allowedHostnames: ["localhost", "127.0.0.1"]
    }
  },
  models: {
    mode: "merge",
    providers: {
      "9router": {
        baseUrl: "http://127.0.0.1:11434/v1",
        api: "openai-responses",
        apiKey: { provider: "default", key: "NINEROUTER_API_KEY" },
        authHeader: true,
        models: { "gpt-5.5": { aliases: ["gpt-5.5"] } }
      }
    }
  },
  agents: {
    defaults: {
      model: { primary: "9router/gpt-5.5" }
    }
  },
  channels: {
    telegram: {
      enabled: true,
      botToken: { provider: "default", key: "TELEGRAM_BOT_TOKEN" },
      dmPolicy: "open",
      groupPolicy: "open",
      execApprovals: { enabled: false }
    }
  }
}
JSON

openclaw config patch --file /tmp/openclaw-cortexos-policy.json5
sudo systemctl restart openclaw-gateway
```

If Telegram is not configured yet, leave `TELEGRAM_BOT_TOKEN` commented and
temporarily remove the `channels.telegram` block from the patch. Once the token
is available, add it to `/opt/cortexos/.secrets/openclaw-gateway.env`, reapply
the patch, and restart `openclaw-gateway`.

## LAN Web UI access

Tailscale Serve publishes `https://${CORTEX_DOMAIN}:18789/` from the loopback
gateway. For local LAN browsers, bind socket proxies on each non-tailnet IPv4
address and forward them to `127.0.0.1:18789`. This avoids a second OpenClaw
instance and keeps all agents/projects in one Web UI.

```bash
LAN_IFACES="$(ip -o -4 addr show scope global | awk '$2 !~ /^tailscale/ {print $2\":\"$4}')"
printf '%s\n' "$LAN_IFACES"

for entry in $LAN_IFACES; do
  iface="${entry%%:*}"
  cidr="${entry#*:}"
  ip="${cidr%%/*}"
  unit="openclaw-lan-${iface}"
  sudo tee "/etc/systemd/system/${unit}.socket" >/dev/null <<EOF
[Unit]
Description=OpenClaw LAN socket proxy (${iface})

[Socket]
ListenStream=${ip}:18789
NoDelay=true

[Install]
WantedBy=sockets.target
EOF
  sudo tee "/etc/systemd/system/${unit}.service" >/dev/null <<EOF
[Unit]
Description=OpenClaw LAN proxy (${iface})
Requires=${unit}.socket

[Service]
ExecStart=/usr/lib/systemd/systemd-socket-proxyd 127.0.0.1:18789
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
done

sudo systemctl daemon-reload
for entry in $LAN_IFACES; do
  iface="${entry%%:*}"
  sudo systemctl enable --now "openclaw-lan-${iface}.socket"
done
```

## Verify

```bash
systemctl is-enabled openclaw-gateway
systemctl show openclaw-gateway -p After,Wants
curl -fsS http://127.0.0.1:18789/health
openclaw models status --json | jq -r '.resolvedDefault'
openclaw channels status --deep --json | jq '.channels.telegram.running'
```

Expected: gateway health OK, model resolves to `9router/gpt-5.5`, and Telegram
is running when `TELEGRAM_BOT_TOKEN` is configured.

## CHECKPOINT 2

**STOP — operator question:** OpenClaw gateway is healthy?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/41-openclaw-channels.md`
