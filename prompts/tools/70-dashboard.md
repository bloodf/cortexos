# Dashboard (latest)

## Purpose

Build and deploy the CortexOS Next.js dashboard to the VPS. The dashboard is a live read/update panel over VPS state — it does NOT import or store credentials.

## Prerequisites

- `14-postgresql.md` completed (schema already applied).
- `13-caddy.md` completed (Caddy proxies `{DOMAIN}` → port 3080).
- `40-openclaw.md` completed (dashboard chat panel connects to OpenClaw gateway).
- Node.js ≥ 20 on the VPS.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

> **Node bootstrap.** Ubuntu uses Linuxbrew's `node@24`. Fedora installs Node 22 via `pkg_install nodejs npm`. RHEL/Rocky/AlmaLinux 9 cap AppStream at `nodejs:20` — `dashboard/scripts/provision-vps.sh` branches on `pkg_family` + `pkg_subfamily` and falls back to NodeSource (`setup_22.x`) when the AppStream stream is missing (e.g., RHEL 10, minimal images). See `docs/RHEL-FAMILY-SUPPORT.md` "Node 20 AppStream caveat".

## CHECKPOINT 1

Operator: confirm Node.js ≥ 20 is installed on the VPS and `/opt/cortexos/.secrets/dashboard.env` exists with `DATABASE_URL`. Type "confirmed" to proceed.

## Install

Run `deploy.sh` from your local machine (not on the VPS):

```bash
# From repo root on your local machine:
cd dashboard
CORTEX_HOSTNAME={VPS_HOSTNAME} CORTEX_USER={VPS_USER} ./deploy.sh
```

`deploy.sh` performs: build → rsync → migrate → restart → health-check.

### Next.js 16 standalone gap — `public/` must be explicit-rsync'd

Next.js 16 `output: "standalone"` does **not** bundle the `public/`
directory into `.next/standalone/`. `deploy.sh` therefore rsyncs the
standalone tree first, then performs a second pass to copy
`dashboard/public/` to `<target>/public/`. Confirmed on the live VPS
during Phase H: without the second pass, static assets (favicons,
locale JSON, brand SVGs) return 404 and `/en/login` renders broken.

If you fork `deploy.sh`, keep both rsync passes.

**Do not** paste credentials into the dashboard UI. All keys are sourced from VPS `.secrets/` files.

## Systemd unit

Install dashboard systemd unit from `templates/systemd/cortex-dashboard.service`. Substitute `{VPS_USER}`, `{NODE_BIN}`, `{NODE_BIN_DIR}` (Linuxbrew default `{NODE_BIN}=/home/linuxbrew/.linuxbrew/opt/node@24/bin/node`).

Unit declares `After=network-online.target postgresql.service docker.service` + `Wants=network-online.target` so the dashboard waits for routable network AND its database deps before launch — critical for clean post-reboot auto-start.

```bash
sudo install -m 644 templates/systemd/cortex-dashboard.service /etc/systemd/system/cortex-dashboard.service
# sed -i the placeholders, then:
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-dashboard
```

Verify auto-boot wiring:

```bash
systemctl is-enabled cortex-dashboard   # → enabled
systemctl show cortex-dashboard -p After,Wants   # contains network-online.target
```

## Configure

Add dashboard env vars to `/opt/cortexos/.secrets/dashboard.env` on the VPS if not already present:

```bash
# On VPS:
cat >> /opt/cortexos/.secrets/dashboard.env <<EOF
CORTEX_MASTER_KEY={CORTEX_MASTER_KEY}
OPENCLAW_BASE=http://127.0.0.1:18789
AGENTGATEWAY_BASE=http://127.0.0.1:18800
NEXT_PUBLIC_APP_URL=https://{DOMAIN}
EOF
sudo chmod 600 /opt/cortexos/.secrets/dashboard.env
sudo systemctl restart cortex-dashboard
```

## Verify

```bash
curl -sS -o /dev/null -w "%{http_code}" https://{DOMAIN}/en/login
```

Expected: `200`.

## CHECKPOINT 2

Operator: confirm the dashboard login page loads at `https://{DOMAIN}/en/login` with no certificate errors, and the OpenClaw chat panel connects successfully. Type "confirmed" to proceed.

## Next

→ `prompts/tools/80-agent-factory.md`
