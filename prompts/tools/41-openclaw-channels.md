# OpenClaw Channels (latest) — Telegram, Slack, Discord, WhatsApp

## Purpose

Configure messaging channels in OpenClaw. **All four channels are optional.** Register only the channels you want OpenClaw to deliver agent notifications through; skip the rest. Each registered channel must render canonical rich blocks (emoji + buttons) per `templates/messages/schema.json`.

> **Recommendation.** Register **at least one** channel before completing the install. Without one, OpenClaw can only surface notifications inside the dashboard — no Telegram/Slack/Discord/WhatsApp delivery, no out-of-band agent pings.

## Prerequisites

- `40-openclaw.md` completed.
- Zero or more channel credentials in hand. You configure only the channels you have creds for.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — chosen which channels to register (zero or more)
- [ ] `npm install -g @openclaw/channels@latest @openclaw/slack@latest`
- [ ] (optional) Register Telegram via `openclaw config channels set telegram --token ...`
- [ ] (optional) Register Slack via `openclaw config channels set slack --token ... --signing-secret ...`
- [ ] (optional) Register Discord via `openclaw config channels set discord --token ... --application-id ...`
- [ ] (optional) Register WhatsApp via `openclaw config channels set whatsapp --access-token ... --phone-number-id ...`
- [ ] `sudo systemctl reload openclaw`
- [ ] Run `openclaw channels test <name>` for each registered channel and confirm delivery
- [ ] CHECKPOINT 2 confirmed — every channel you registered delivered the probe (no skipped channel verified)

## CHECKPOINT 1

**STOP — operator question:** Have you decided which channels (zero or more of Telegram, Slack, Discord, WhatsApp) you will register **in this run**, and do you have the credentials in hand for **each one you chose**?

Skipping every channel is allowed (OpenClaw still installs cleanly) but **not recommended** — without at least one channel, agent notifications are dashboard-only.

Type `confirmed` to proceed.

## Install

```bash
npm install -g @openclaw/channels@latest
# The Slack adapter is NOT bundled with @openclaw/channels — install
# it explicitly. Phase H verification on 2026-05-16 showed it missing
# on a fresh VPS, which silently disables every Slack send.
npm install -g @openclaw/slack@latest
```

## Configure

Run **only** the blocks for channels you chose at CHECKPOINT 1. Channel config merges into `~/.openclaw/openclaw.json` — unregistered channels stay absent (OpenClaw treats absent config as "channel disabled", not error).

### Telegram (optional)

```bash
openclaw config channels set telegram \
  --token "{TELEGRAM_BOT_TOKEN}"
```

### Slack (optional)

```bash
openclaw config channels set slack \
  --token "{SLACK_BOT_TOKEN}" \
  --signing-secret "{SLACK_SIGNING_SECRET}"
```

### Discord (optional)

```bash
openclaw config channels set discord \
  --token "{DISCORD_BOT_TOKEN}" \
  --application-id "{DISCORD_APP_ID}"
```

### WhatsApp (optional)

```bash
openclaw config channels set whatsapp \
  --access-token "{WHATSAPP_ACCESS_TOKEN}" \
  --phone-number-id "{WHATSAPP_PHONE_ID}"
```

Reload OpenClaw to pick up channel config (run even if you skipped every channel — confirms config file is valid):

```bash
sudo systemctl reload openclaw
```

## Verify

For **each channel you registered**, send a probe message. Skip the lines for channels you did not register.

```bash
openclaw channels test telegram --message "🤖 CortexOS channel test"
openclaw channels test slack    --message "🤖 CortexOS channel test"
openclaw channels test discord  --message "🤖 CortexOS channel test"
openclaw channels test whatsapp --message "🤖 CortexOS channel test"
```

Expected: probe lands on each registered platform with `🤖` rendered as emoji and no `API error` / `unauthorized` output.

If you registered **zero** channels, list the configured set and confirm it is empty:

```bash
openclaw config channels list
```

Expected: empty list (no error).

## CHECKPOINT 2

**STOP — operator question:** For **every channel you registered at CHECKPOINT 1**, did `openclaw channels test <name>` exit 0 (not `API error`, not `unauthorized`) and did the probe land in the target chat with `🤖` rendered as an emoji (not `:robot:` or `?`)?

If you registered zero channels, answer `confirmed` once `openclaw config channels list` ran without error.

Type `confirmed` to proceed.

## Next

→ `prompts/tools/42-openclaw-openviking.md`
