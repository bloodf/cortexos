# OpenClaw Channels (latest)

## Purpose

Configure the messaging channels you intend to enable in this environment.
Each enabled channel must render canonical rich blocks (emoji + buttons) per
`templates/messages/schema.json`. Channels without credentials may remain
intentionally disabled and be added later.

For the CortexOS VPS main agent, Telegram is configured through the
`openclaw-gateway` systemd environment file and the single OpenClaw gateway
created in `40-openclaw.md`; do not create a separate OpenClaw instance for
Telegram.

## Prerequisites

- `40-openclaw.md` completed.
- Credentials ready for the channels you want to enable now (optional —
  this step can be skipped entirely and revisited later).

> All channels are **optional**. You may skip every channel in this
> step. We **recommend registering at least one channel** so OpenClaw
> can deliver agent output somewhere reachable.

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

**STOP — operator question:** Did you decide which channels (if any) to register now — knowing every channel is optional and the step can be skipped entirely?

Type `confirmed` to proceed.

## Install

No separate channel plugin package is installed here. Use the channel support exposed by the installed OpenClaw CLI; stale package names such as `@openclaw/slack` are intentionally not used.

## Configure

Run only the stanzas for channels you want to enable now. Skip the
rest. All four channels are optional.

### Telegram (optional)

Skip unless you have a Telegram bot token from `@BotFather`.

```bash
sudo install -d -m 0700 -o cortexos -g cortexos /opt/cortexos/.secrets
sudoedit /opt/cortexos/.secrets/openclaw-gateway.env
# Add or update:
# TELEGRAM_BOT_TOKEN=<telegram-bot-token>
sudo chmod 600 /opt/cortexos/.secrets/openclaw-gateway.env
sudo systemctl restart openclaw-gateway
```

The gateway policy from `40-openclaw.md` sets Telegram `dmPolicy=open`,
`groupPolicy=open`, and disables Telegram exec confirmations for the trusted
VPS agent. If owner-only commands are required, send one message to the bot,
read the sender ID from `openclaw directory self --channel telegram --json` or
Telegram updates, then set `commands.ownerAllowFrom` to
`["telegram:<sender-id>"]`.

### Slack (optional)

Skip unless you have a Slack bot token (and an app token or signing
secret depending on mode).

```bash
openclaw channels add --channel slack --bot-token "<slack-bot-token>" --app-token "<slack-app-token>"
```

### Discord (optional)

Skip unless you have a Discord bot token and application ID.

```bash
openclaw channels add --channel discord --token "<discord-bot-token>" --application-id "<discord-app-id>"
```

### WhatsApp (optional)

Skip unless you have a WhatsApp Business access token and phone number ID.

```bash
openclaw channels add --channel whatsapp --access-token "<whatsapp-access-token>" --phone-number-id "<whatsapp-phone-id>"
```

## Verify

Probe only the channels you enabled. If you skipped every channel,
skip this verify block too.

```bash
openclaw channels status --channel telegram --probe --json || true
openclaw channels status --channel slack --probe --json || true
openclaw channels status --channel discord --probe --json || true
openclaw channels status --channel whatsapp --probe --json || true
```

Expected: each **enabled** channel reports successful auth/probe
status. Channels you skipped will report not-configured; that is
fine.

## CHECKPOINT 2

**STOP — operator question:** All enabled channel probes succeeded with no API errors (or you intentionally skipped every channel)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/42-openclaw-openviking.md`
