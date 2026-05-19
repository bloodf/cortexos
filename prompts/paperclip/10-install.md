# Paperclip ↔ CortexOS — Install Paperclip

> Stage 1. Run after `00-overview.md` checkpoint passes. Operator-facing.

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] Pin `PAPERCLIP_SHA` to audited commit
- [ ] `npx paperclipai@<SHA> onboard --yes` (company `CortexOS`)
- [ ] Record onboarder-emitted company ID + board token
- [ ] Install `/opt/cortexos/.secrets/paperclip.env` from template (mode 0600, owner cortex:cortex)
- [ ] Fill `PAPERCLIP_API_URL`, `PAPERCLIP_API_KEY`, `PAPERCLIP_WEBHOOK_SECRET`, `CORTEX_NATS_HMAC`, `PG_DSN`
- [ ] Create `cortexos-bridge` agent in Paperclip + mint API key
- [ ] CHECKPOINT 1.A confirmed — env file present + permissions correct
- [ ] CHECKPOINT 1.B confirmed — `CORTEX_NATS_HMAC` matches cortex-consumer

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

**STOP — operator question:** Does `stat -c '%a %U:%G' /opt/cortexos/.secrets/paperclip.env` print `600 cortex:cortex` (not `644`, not `root:root`)?

Type `confirmed` to proceed.

## CHECKPOINT 1.B

**STOP — operator question:** Does `diff <(sudo grep -E '^CORTEX_NATS_HMAC=' /opt/cortexos/.secrets/paperclip.env) <(sudo grep -E '^CORTEX_NATS_HMAC=' /opt/cortexos/.secrets/consumer.env)` print no output (not a `<`/`>` diff line)?

Type `confirmed` to proceed.

Proceed to `20-bridge.md`.
