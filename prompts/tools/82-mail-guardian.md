# Cortex Mail Guardian

## Purpose

Install the optional Cortex-owned IMAP spam guardian. It watches selected inboxes,
classifies messages through 9Router, moves high-confidence spam to Trash, and
sends a Telegram review request to the owner when a decision is uncertain.

Backend-only service: no web UI, no open URL. Appears in the healthcheck dashboard
and in the Mail Guardian admin page (`/{locale}/mail-guardian`).

## Prerequisites

- `31-9router.md` completed (9Router must be running and reachable).
- `70-dashboard.md` completed (PostgreSQL and the cortex_dashboard DB must exist).
- Cortex Telegram bot set up and the owner has sent `/start` to it.
- IMAP app passwords ready for the accounts to be monitored.

---

## STOP — Input Required

**Do not proceed past this section until the operator has provided all values.**

Ask the operator for the following, one at a time. Offer defaults where shown but
require explicit confirmation before using them.

### 9Router / model

```
NINEROUTER_BASE_URL   [default: http://localhost:11434/v1]
NINEROUTER_API_KEY    (required — no default)
MAIL_GUARDIAN_MODEL   [default: minimax/MiniMax-M2.7-highspeed]
```

### Telegram (for review notifications)

```
TELEGRAM_BOT_TOKEN                     (required — no default)
MAIL_GUARDIAN_TELEGRAM_OWNER_CHAT_ID   (required — see discovery step below)
```

To discover the owner chat ID if unknown, run after the package is built:

```bash
set -a
source /opt/cortexos/.secrets/mail-guardian.env
set +a
node /opt/cortexos/packages/cortex-mail-guardian/dist/index.js telegram-discover-owner --write-env
```

This requires the owner to have sent `/start` to the bot. The command writes
`MAIL_GUARDIAN_TELEGRAM_OWNER_CHAT_ID` directly into the env file.

### IMAP accounts

Repeat the block below for each account. Minimum 1 account required.

```
MAIL_GUARDIAN_ACCOUNT_COUNT           (required — number of accounts)

For each account N (starting at 1):
  MAIL_GUARDIAN_ACCOUNT_N_SLUG        e.g. my-inbox
  MAIL_GUARDIAN_ACCOUNT_N_ADDRESS     e.g. me@example.com
  MAIL_GUARDIAN_ACCOUNT_N_HOST        e.g. mail.example.com
  MAIL_GUARDIAN_ACCOUNT_N_PORT        [default: 993]
  MAIL_GUARDIAN_ACCOUNT_N_SECURE      [default: true]
  MAIL_GUARDIAN_ACCOUNT_N_USERNAME    e.g. me@example.com
  MAIL_GUARDIAN_ACCOUNT_N_PASSWORD    (plain — will be base64-encoded below)
  MAIL_GUARDIAN_ACCOUNT_N_INBOX       [default: INBOX]
  MAIL_GUARDIAN_ACCOUNT_N_TRASH_MAILBOX  (optional)
```

### Classifier tuning

```
MAIL_GUARDIAN_CONFIDENCE_THRESHOLD   [default: 0.95]
MAIL_GUARDIAN_MAX_MESSAGES_PER_SWEEP [default: 10]
MAIL_GUARDIAN_MODEL_TIMEOUT_MS       [default: 30000]
```

---

## Step 1 — Build the package

```bash
cd /opt/cortexos
pnpm install
pnpm --filter @cortexos/mail-guardian build
pnpm --filter @cortexos/mail-guardian test
```

Both commands must succeed before continuing.

---

## Step 2 — Create the secrets file via SOPS+age

Passwords must be base64-encoded (not encrypted — base64 is shell-safe parsing,
not a security boundary; the file itself is mode 0600).

```bash
# Encode each IMAP password:
echo -n 'PLAIN_PASSWORD_HERE' | base64
```

Create the encrypted secrets file on the **operator laptop**:

```bash
# On the laptop (where the age private key lives):
cat > /tmp/mail-guardian-plain.yaml << 'EOF'
NINEROUTER_BASE_URL: "http://localhost:11434/v1"
NINEROUTER_API_KEY: "REPLACE_WITH_KEY"
MAIL_GUARDIAN_MODEL: "minimax/MiniMax-M2.7-highspeed"
TELEGRAM_BOT_TOKEN: "REPLACE_WITH_TOKEN"
MAIL_GUARDIAN_TELEGRAM_OWNER_CHAT_ID: "REPLACE_WITH_CHAT_ID"
MAIL_GUARDIAN_CONFIDENCE_THRESHOLD: "0.95"
MAIL_GUARDIAN_ACTION: "trash"
MAIL_GUARDIAN_MAX_MESSAGES_PER_SWEEP: "10"
MAIL_GUARDIAN_MODEL_TIMEOUT_MS: "30000"
MAIL_GUARDIAN_ACCOUNT_COUNT: "1"
MAIL_GUARDIAN_ACCOUNT_1_SLUG: "REPLACE_WITH_SLUG"
MAIL_GUARDIAN_ACCOUNT_1_ADDRESS: "REPLACE@example.com"
MAIL_GUARDIAN_ACCOUNT_1_HOST: "mail.example.com"
MAIL_GUARDIAN_ACCOUNT_1_PORT: "993"
MAIL_GUARDIAN_ACCOUNT_1_SECURE: "true"
MAIL_GUARDIAN_ACCOUNT_1_USERNAME: "REPLACE@example.com"
MAIL_GUARDIAN_ACCOUNT_1_PASSWORD_B64: "REPLACE_WITH_BASE64_PASSWORD"
MAIL_GUARDIAN_ACCOUNT_1_INBOX: "INBOX"
EOF

# Encrypt with SOPS+age (adjust .sops.yaml age recipient as needed):
sops --encrypt /tmp/mail-guardian-plain.yaml \
  > templates/.secrets/mail-guardian.enc.yaml

# Decrypt to VPS via the sanctioned pipeline:
scripts/secrets-decrypt.sh mail-guardian
```

`scripts/secrets-decrypt.sh` decrypts and writes
`/opt/cortexos/.secrets/mail-guardian.env` (mode 0600) on the VPS.

> Never commit the decrypted file. Never copy plaintext passwords over SSH manually.

---

## Step 3 — Apply dashboard migrations

On the VPS, source the dashboard credentials and apply the new migrations:

```bash
set -a
source /opt/cortexos/.secrets/dashboard.env
set +a

for migration in 020_mail_guardian 021_mail_guardian_actions \
                 022_mail_guardian_widgets 023_action_log_mail_guardian_target; do
  PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 \
    -U "${DB_USER:-dashboard}" \
    -d "${DB_NAME:-cortex_dashboard}" \
    -v ON_ERROR_STOP=1 \
    -f /opt/cortexos/packages/cortex-dashboard/migrations/${migration}.sql \
    && echo "Applied ${migration}" || { echo "FAILED ${migration}"; exit 1; }
done
```

---

## Step 4 — Install systemd units

```bash
sudo install -m 0644 \
  /opt/cortexos/templates/systemd/cortex-mail-guardian.service \
  /etc/systemd/system/cortex-mail-guardian.service

sudo install -m 0644 \
  /opt/cortexos/templates/systemd/cortex-mail-guardian-sweep.service \
  /etc/systemd/system/cortex-mail-guardian-sweep.service

sudo install -m 0644 \
  /opt/cortexos/templates/systemd/cortex-mail-guardian-sweep.timer \
  /etc/systemd/system/cortex-mail-guardian-sweep.timer

sudo systemctl daemon-reload
sudo systemctl enable --now cortex-mail-guardian.service
sudo systemctl enable --now cortex-mail-guardian-sweep.timer
```

---

## Step 5 — Verification

```bash
# Service status
systemctl is-active cortex-mail-guardian.service
systemctl is-active cortex-mail-guardian-sweep.timer

# Recent logs
journalctl -u cortex-mail-guardian.service -n 50 --no-pager

# Smoke test (requires all env vars loaded):
set -a
source /opt/cortexos/.secrets/9router.env
source /opt/cortexos/.secrets/dashboard.env
source /opt/cortexos/.secrets/mail-guardian.env
set +a

node /opt/cortexos/packages/cortex-mail-guardian/dist/index.js smoke

# Manual sweep (dry run):
MAIL_GUARDIAN_DRY_RUN=true \
node /opt/cortexos/packages/cortex-mail-guardian/dist/index.js sweep
```

Expected output from smoke: `cortex-mail-guardian smoke ok`

Check the dashboard: navigate to `/{locale}/mail-guardian` — the Reviews and
Accounts tabs should load. After the first real sweep a row should appear in
the reviews table.

---

## Owner Decisions

When a review is pending, the Cortex Telegram bot sends a message with inline
buttons (Spam/Keep/Block sender/Allow sender). The owner can also decide via
the dashboard Mail Guardian page.

To apply a decision manually from the host:

```bash
node /opt/cortexos/packages/cortex-mail-guardian/dist/index.js decide \
  <review-id> <spam|keep|block_sender|allow_sender>
```

---

## Rollback

```bash
sudo systemctl disable --now cortex-mail-guardian.service cortex-mail-guardian-sweep.timer
sudo rm /etc/systemd/system/cortex-mail-guardian{,-sweep}.{service,timer}
sudo systemctl daemon-reload

# Rollback migrations (in reverse order):
for migration in 023_action_log_mail_guardian_target 022_mail_guardian_widgets \
                 021_mail_guardian_actions 020_mail_guardian; do
  PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 \
    -U "${DB_USER:-dashboard}" \
    -d "${DB_NAME:-cortex_dashboard}" \
    -v ON_ERROR_STOP=1 \
    -f /opt/cortexos/packages/cortex-dashboard/migrations/${migration}.rollback.sql \
    && echo "Rolled back ${migration}"
done
```
