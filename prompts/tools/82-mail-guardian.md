# Cortex Mail Guardian

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

## Purpose

Install the optional Cortex-owned IMAP spam guardian. It watches selected inboxes,
classifies messages through 9Router, moves high-confidence spam to Trash, and
asks the owner through the existing Cortex Telegram bot when a decision is
uncertain.

This is an optional process. It is not a Paperclip workflow bus and it must not
run its own Telegram long-poller when the Cortex Hermes gateway already owns
Telegram polling.

## Prerequisites

- `31-9router.md` completed.
- `41-hermes-profiles.md` completed with the `cortex` profile.
- `70-dashboard.md` completed.
- Cortex Telegram bot paired with the owner through Hermes pairing.
- IMAP app passwords for exactly three monitored accounts.

## Runtime Model

```text
systemd timer / listener
  -> IMAP over TLS
  -> 9Router model minimax/MiniMax-M2.7-highspeed
  -> dashboard DB redacted state
  -> Cortex Telegram owner review when needed
```

Model calls must route through 9Router only. Do not add direct provider calls.

## Secrets

Create `/opt/cortexos/.secrets/mail-guardian.env` with mode `0600`.
Passwords are base64-encoded for shell-safe env parsing; base64 is not
encryption, so keep this file private.

Required keys:

```text
MAIL_GUARDIAN_MODEL=minimax/MiniMax-M2.7-highspeed
MAIL_GUARDIAN_CONFIDENCE_THRESHOLD=0.95
MAIL_GUARDIAN_ACTION=trash
MAIL_GUARDIAN_MAX_MESSAGES_PER_SWEEP=10
MAIL_GUARDIAN_MODEL_TIMEOUT_MS=30000
MAIL_GUARDIAN_TELEGRAM_OWNER_CHAT_ID=<numeric-owner-chat-id>
MAIL_GUARDIAN_ACCOUNT_COUNT=3
MAIL_GUARDIAN_ACCOUNT_1_SLUG=<slug>
MAIL_GUARDIAN_ACCOUNT_1_ADDRESS=<email>
MAIL_GUARDIAN_ACCOUNT_1_HOST=<imap-host>
MAIL_GUARDIAN_ACCOUNT_1_PORT=993
MAIL_GUARDIAN_ACCOUNT_1_SECURE=true
MAIL_GUARDIAN_ACCOUNT_1_USERNAME=<email>
MAIL_GUARDIAN_ACCOUNT_1_PASSWORD_B64=<base64-app-password>
MAIL_GUARDIAN_ACCOUNT_1_INBOX=INBOX
```

Repeat the account block for accounts 2 and 3.

The service also loads:

```text
/opt/cortexos/.secrets/9router.env
/opt/cortexos/.secrets/dashboard.env
/opt/cortexos/.secrets/hermes/cortex.env
```

## Install

Build and verify the package:

```bash
cd /opt/cortexos
pnpm --filter @cortexos/mail-guardian build
pnpm --filter @cortexos/mail-guardian test
```

Apply dashboard migrations:

```bash
set -a
source /opt/cortexos/.secrets/dashboard.env
set +a

PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 \
  -U "${DB_USER:-dashboard}" \
  -d "${DB_NAME:-cortex_dashboard}" \
  -v ON_ERROR_STOP=1 \
  -f /opt/cortexos/packages/cortex-dashboard/migrations/004_mail_guardian.sql

PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 \
  -U "${DB_USER:-dashboard}" \
  -d "${DB_NAME:-cortex_dashboard}" \
  -v ON_ERROR_STOP=1 \
  -f /opt/cortexos/packages/cortex-dashboard/migrations/005_mail_guardian_widgets.sql
```

Install and enable systemd units:

```bash
sudo install -m 0644 /opt/cortexos/templates/systemd/cortex-mail-guardian.service \
  /etc/systemd/system/cortex-mail-guardian.service
sudo install -m 0644 /opt/cortexos/templates/systemd/cortex-mail-guardian-sweep.service \
  /etc/systemd/system/cortex-mail-guardian-sweep.service
sudo install -m 0644 /opt/cortexos/templates/systemd/cortex-mail-guardian-sweep.timer \
  /etc/systemd/system/cortex-mail-guardian-sweep.timer
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-mail-guardian.service cortex-mail-guardian-sweep.timer
```

## Owner Decisions

The Cortex Hermes gateway owns Telegram polling. Mail guardian review messages
include a decision command. Cortex should run:

```bash
node /opt/cortexos/packages/cortex-mail-guardian/dist/index.js decide \
  <review-id> <spam|keep|block_sender|allow_sender>
```

## Verify

```bash
set -a
source /opt/cortexos/.secrets/9router.env
source /opt/cortexos/.secrets/dashboard.env
source /opt/cortexos/.secrets/hermes/cortex.env
source /opt/cortexos/.secrets/mail-guardian.env
set +a

node /opt/cortexos/packages/cortex-mail-guardian/dist/index.js smoke
node /opt/cortexos/packages/cortex-mail-guardian/dist/index.js sweep
systemctl is-active cortex-mail-guardian.service
systemctl is-active cortex-mail-guardian-sweep.timer
```

The sweep scans read and unread inbox messages, deduplicates by account and UID,
and processes at most `MAIL_GUARDIAN_MAX_MESSAGES_PER_SWEEP` messages per run.
