# Weekly Smoke Tests (latest)

## Purpose
Install the weekly smoke-test pipeline: a publisher script
(`/usr/local/bin/cortex-smoke-publish.sh`) plus per-slug systemd
templates (`cortex-smoke@.service` + `cortex-smoke@.timer`) that fire
every Monday and publish a synthetic
`cortex.factory.workflow.<slug>.weekly-smoke` envelope through NATS.
Each envelope is consumed by `cortex-consumer` and is intended to
verify the full deliver-to-channel chain.

`cieucpb` is intentionally excluded — its daily Postgres-dump backup
plus channel heartbeat already covers the same surface, and weekly
WhatsApp PMs to the operator are not desired.

## Prerequisites
- `60-cortex-consumer.md` completed.
- `30-nats.md` completed.
- `nats` CLI installed on the host (not just the container).

## CHECKPOINT 1
Operator: confirm `nats --version` works and `cortex-consumer.service`
is active. Type "confirmed" to proceed.

## Install

Publisher script:

```bash
sudo tee /usr/local/bin/cortex-smoke-publish.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
slug="${1:?missing slug}"
subject="cortex.factory.workflow.${slug}.weekly-smoke"
payload=$(jq -nc \
  --arg slug  "$slug" \
  --arg ts    "$(date -u +%FT%TZ)" \
  --arg nonce "$(uuidgen)" \
  '{slug:$slug, kind:"weekly-smoke", ts:$ts, nonce:$nonce}')
exec nats pub --server nats://127.0.0.1:4222 "$subject" "$payload"
EOF
sudo chmod 755 /usr/local/bin/cortex-smoke-publish.sh
```

Systemd template service:

```bash
sudo tee /etc/systemd/system/cortex-smoke@.service <<'EOF'
[Unit]
Description=CortexOS weekly smoke publish for %i
After=network.target nats.service cortex-consumer.service

[Service]
Type=oneshot
User=bloodf
ExecStart=/usr/local/bin/cortex-smoke-publish.sh %i
EOF
```

Systemd template timer:

```bash
sudo tee /etc/systemd/system/cortex-smoke@.timer <<'EOF'
[Unit]
Description=CortexOS weekly smoke timer for %i

[Timer]
OnCalendar=Mon *-*-* 09:00:00 UTC
RandomizedDelaySec=120
Persistent=true
Unit=cortex-smoke@%i.service

[Install]
WantedBy=timers.target
EOF
```

Enable per slug (excluding `cieucpb`):

```bash
sudo systemctl daemon-reload
for slug in 3guns mementry celebrar netbook; do
  sudo systemctl enable --now "cortex-smoke@${slug}.timer"
done
```

## Verify

```bash
sudo systemctl list-timers 'cortex-smoke*' --all --no-pager
```

Expected (sample evidence from live VPS 2026-05-16):

```
NEXT                             LEFT LAST PASSED UNIT
Mon 2026-05-18 09:00:30 UTC 1 day 23h -    -      cortex-smoke@netbook.timer
Mon 2026-05-18 09:01:09 UTC 1 day 23h -    -      cortex-smoke@celebrar.timer
Mon 2026-05-18 09:01:21 UTC 1 day 23h -    -      cortex-smoke@3guns.timer
Mon 2026-05-18 09:01:43 UTC 1 day 23h -    -      cortex-smoke@mementry.timer
```

## Known Limitations

### Phase H FAIL — channel deliveries silently dropped at OpenClaw

Smoke-test publishes reach NATS and are consumed correctly. The
downstream POST to `http://127.0.0.1:18789/sendMessage` returns
HTTP 404 because OpenClaw `2026.5.12` does not expose that route — see
`docs/MESSAGING.md` → "Known Limitations" and `60-cortex-consumer.md`
→ "OpenClaw gateway `/sendMessage` returns 404".

Until the operator resolves blocker #1, weekly smoke timers will fire
and log a delivery failure, but no Telegram / Slack / Discord /
WhatsApp message will reach the corresponding account.

## CHECKPOINT 2
Operator: confirm timers list-timers shows the four enabled slugs and
the next-fire timestamp is in the future. Type "confirmed" to proceed.

## Next
→ `prompts/tools/70-dashboard.md`
