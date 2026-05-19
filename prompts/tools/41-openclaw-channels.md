# OpenClaw Channels (latest) — Telegram, Slack, Discord, WhatsApp

## Purpose

Configure all four mandatory v1.0 messaging channels in OpenClaw. All four must be operational before v1.0 sign-off. Each must render canonical rich blocks (emoji + buttons) per `templates/messages/schema.json`.

## Prerequisites

- `40-openclaw.md` completed.
- Bot tokens / webhook URLs for all four platforms ready.

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

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Configure
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Verify this checkpoint's preconditions are met?

Operator: gather and confirm you have:

- Telegram bot token (from @BotFather)
- Slack bot OAuth token + signing secret
- Discord bot token + application ID
- WhatsApp Business API access token + phone number ID

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

Write channel config into `~/.openclaw/openclaw.json` (merge, do not overwrite):

```bash
openclaw config channels set telegram \
  --token "{TELEGRAM_BOT_TOKEN}"

openclaw config channels set slack \
  --token "{SLACK_BOT_TOKEN}" \
  --signing-secret "{SLACK_SIGNING_SECRET}"

openclaw config channels set discord \
  --token "{DISCORD_BOT_TOKEN}" \
  --application-id "{DISCORD_APP_ID}"

openclaw config channels set whatsapp \
  --access-token "{WHATSAPP_ACCESS_TOKEN}" \
  --phone-number-id "{WHATSAPP_PHONE_ID}"
```

Reload OpenClaw to pick up channel config:

```bash
sudo systemctl reload openclaw
```

## Verify

Test each channel by sending a probe message:

```bash
openclaw channels test telegram --message "🤖 CortexOS channel test"
openclaw channels test slack    --message "🤖 CortexOS channel test"
openclaw channels test discord  --message "🤖 CortexOS channel test"
openclaw channels test whatsapp --message "🤖 CortexOS channel test"
```

Expected: probe message received on each platform with no errors.

## CHECKPOINT 2

**STOP — operator question:** All four channel test messages were received, emoji rendered correctly, and no API errors were reported?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/42-openclaw-openviking.md`
