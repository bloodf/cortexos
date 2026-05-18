# Paperclip ↔ CortexOS — Install Paperclip

> Stage 1. Run after `00-overview.md` checkpoint passes. Operator-facing.

## 1. Install Paperclip via onboard CLI

Pin the commit SHA before running so the install is reproducible.

```bash
# Replace <SHA> with the audited commit you intend to deploy.
PAPERCLIP_SHA="<SHA>"
npx --yes "paperclipai@${PAPERCLIP_SHA}" onboard --yes
```

The onboarder will:

1. Provision a local Paperclip stack (Tailscale-only by default).
2. Prompt for company name; use `CortexOS`.
3. Emit a company ID and a board token.

## 2. Capture identifiers

```bash
sudo install -d -o cortex -g cortex -m 0700 /opt/cortexos/.secrets
sudo install -o cortex -g cortex -m 0600 \
  templates/.secrets/paperclip.env.example \
  /opt/cortexos/.secrets/paperclip.env
```

Then edit `/opt/cortexos/.secrets/paperclip.env` and fill:

- `PAPERCLIP_API_URL` — Tailscale URL from the onboarder.
- `PAPERCLIP_API_KEY` — bearer minted via `POST /api/agents/<bridge-agent-id>/keys`.
- `PAPERCLIP_WEBHOOK_SECRET` — generate locally:

  ```bash
  openssl rand -hex 32
  ```

- `CORTEX_NATS_HMAC` — copy from `cortex-consumer` env (must match).
- `PG_DSN` — same DSN dashboard uses.

Re-assert permissions:

```bash
sudo chmod 600 /opt/cortexos/.secrets/paperclip.env
sudo chown cortex:cortex /opt/cortexos/.secrets/paperclip.env
```

## 3. Create the bridge agent in Paperclip

Use the Paperclip UI or API to create an agent named `cortexos-bridge` with role `system`. Mint its key:

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer ${BOARD_TOKEN}" \
  "${PAPERCLIP_API_URL}/api/agents/<bridge-agent-id>/keys"
```

Place the returned token into `PAPERCLIP_API_KEY` in the env file.

## CHECKPOINT 1.A

- [ ] `paperclipai onboard` completed; company `CortexOS` exists.
- [ ] `/opt/cortexos/.secrets/paperclip.env` present, mode 0600, owner cortex:cortex.
- [ ] All required env vars populated.
- [ ] `CORTEX_NATS_HMAC` byte-matches the value used by `cortex-consumer`.

Proceed to `20-bridge.md`.
