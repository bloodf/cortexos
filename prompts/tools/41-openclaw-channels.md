# OpenClaw Channels (latest)

## Purpose

Configure the messaging channels you intend to enable in this environment.
Each enabled channel must render canonical rich blocks (emoji + buttons) per
`templates/messages/schema.json`. Channels without credentials may remain
intentionally disabled and be added later.

## Prerequisites

- `40-openclaw.md` completed.
- Credentials ready for the channels you want to enable now.

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
- [ ] Configure
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** You have credentials for the channels you want to enable now?

Examples:
- Telegram bot token
- Slack bot token (+ app token or signing secret, depending on mode)
- Discord bot token + application ID
- WhatsApp Business access token + phone number ID

Type `confirmed` to proceed.

## Install

Use the current OpenClaw CLI channel surface. Some older package names are stale.

```bash
npm install -g @openclaw/slack@latest || true
```

## Configure

Examples:

```bash
openclaw channels add --channel telegram --token "<telegram-bot-token>"
openclaw channels add --channel slack --bot-token "<slack-bot-token>" --app-token "<slack-app-token>"
openclaw channels add --channel discord --token "<discord-bot-token>" --application-id "<discord-app-id>"
openclaw channels add --channel whatsapp --access-token "<whatsapp-access-token>" --phone-number-id "<whatsapp-phone-id>"
```

## Verify

Probe only the channels you enabled:

```bash
openclaw channels status --channel telegram --probe --json || true
openclaw channels status --channel slack --probe --json || true
openclaw channels status --channel discord --probe --json || true
openclaw channels status --channel whatsapp --probe --json || true
```

Expected: each enabled channel reports successful auth/probe status.

## CHECKPOINT 2

**STOP — operator question:** All enabled channel probes succeeded and no API errors were reported?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/42-openclaw-openviking.md`
