# Weekly Synthetic Traffic (VPS-only recurring health signal)

## Purpose

Install the weekly synthetic-traffic pipeline: a publisher script
(`/usr/local/bin/cortex-synthetic-publish.sh`) plus per-slug systemd
templates (`cortex-synthetic@.service` + `cortex-synthetic@.timer`) that
fire every Monday and publish a synthetic
`cortex.factory.workflow.<slug>.weekly-heartbeat` envelope through NATS.
Each envelope is consumed by `cortex-consumer` and exercises the full
deliver-to-channel chain on a recurring schedule.

`cieucpb` is intentionally excluded — its daily Postgres-dump backup
plus channel heartbeat already covers the same surface, and weekly
WhatsApp PMs to the operator are not desired.

## Prerequisites

- `60-cortex-consumer.md` completed.
- `30-nats.md` completed.
- `nats` CLI installed on the host (not just the container).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
pkg_install jq uuid-runtime  # uuidgen for synthetic payload
```


## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Verify
- [ ] Known Limitations
- [ ] CHECKPOINT 2 confirmed
## CHECKPOINT 1

**STOP — operator question:** `nats --version` works and `cortex-consumer.service`?

service`
is active.

Type `confirmed` to proceed.
## Install

Publisher script:

```bash
sudo tee /usr/local/bin/cortex-synthetic-publish.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
slug="${1:?missing slug}"
subject="cortex.factory.workflow.${slug}.weekly-heartbeat"
payload=$(jq -nc \
  --arg slug  "$slug" \
  --arg ts    "$(date -u +%FT%TZ)" \
  --arg nonce "$(uuidgen)" \
  '{slug:$slug, kind:"weekly-heartbeat", ts:$ts, nonce:$nonce}')
exec nats pub --server nats://127.0.0.1:4222 "$subject" "$payload"
EOF
sudo chmod 755 /usr/local/bin/cortex-synthetic-publish.sh
```

Systemd template service:

```bash
sudo tee /etc/systemd/system/cortex-synthetic@.service <<'EOF'
[Unit]
Description=CortexOS weekly synthetic publish for %i
After=network.target nats.service cortex-consumer.service

[Service]
Type=oneshot
User=bloodf
ExecStart=/usr/local/bin/cortex-synthetic-publish.sh %i
EOF
```

Systemd template timer:

```bash
sudo tee /etc/systemd/system/cortex-synthetic@.timer <<'EOF'
[Unit]
Description=CortexOS weekly synthetic timer for %i

[Timer]
OnCalendar=Mon *-*-* 09:00:00 UTC
RandomizedDelaySec=120
Persistent=true
Unit=cortex-synthetic@%i.service

[Install]
WantedBy=timers.target
EOF
```

Enable per slug (excluding `cieucpb`):

```bash
sudo systemctl daemon-reload
for slug in 3guns mementry celebrar netbook; do
  sudo systemctl enable --now "cortex-synthetic@${slug}.timer"
done
```

## Verify

```bash
sudo systemctl list-timers 'cortex-synthetic*' --all --no-pager
```

Expected (sample evidence from live VPS 2026-05-16):

```text
NEXT                             LEFT LAST PASSED UNIT
Mon 2026-05-18 09:00:30 UTC 1 day 23h -    -      cortex-synthetic@netbook.timer
Mon 2026-05-18 09:01:09 UTC 1 day 23h -    -      cortex-synthetic@celebrar.timer
Mon 2026-05-18 09:01:21 UTC 1 day 23h -    -      cortex-synthetic@3guns.timer
Mon 2026-05-18 09:01:43 UTC 1 day 23h -    -      cortex-synthetic@mementry.timer
```

## Known Limitations

### Channel delivery runs through the OpenClaw CLI

Synthetic publishes reach NATS, get consumed, then `consumer.js` shells
out to `openclaw message send --json --account … --channel … --target …`
to fan out to Telegram / Slack / Discord / WhatsApp. The legacy
`/sendMessage` HTTP path (404 on `2026.5.12`+) has been removed — see
`docs/MESSAGING.md` and `60-cortex-consumer.md`.

Per-platform delivery health is observable via `openclaw_http_ok_total`
/ `openclaw_http_errors_total` on `:7081/metrics` (CLI shellouts and the
opt-in `v1` HTTP path both feed the same counters).

## CHECKPOINT 2

**STOP — operator question:** Timers list-timers shows the four enabled slugs and?

Operator: confirm timers list-timers shows the four enabled slugs and
the next-fire timestamp is in the future.

Type `confirmed` to proceed.
## Next

→ `prompts/tools/70-dashboard.md`
