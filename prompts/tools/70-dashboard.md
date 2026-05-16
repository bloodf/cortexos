# Dashboard (latest)

## Purpose
Build and deploy the CortexOS Next.js dashboard to the VPS. The dashboard is a live read/update panel over VPS state — it does NOT import or store credentials.

## Prerequisites
- `14-postgresql.md` completed (schema already applied).
- `13-caddy.md` completed (Caddy proxies `{DOMAIN}` → port 3080).
- `40-openclaw.md` completed (dashboard chat panel connects to OpenClaw gateway).
- Node.js ≥ 20 on the VPS.

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
