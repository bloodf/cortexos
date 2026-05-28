# 90 - CortexOS Ops Services

Deploys four host-level operational services that keep CortexOS healthy and
up to date: automated daily updates, 9Router active health probing,
AI-driven degraded-service repair, and twice-daily encrypted backups.

## What each unit does

| Unit | Schedule | Purpose |
|------|----------|---------|
| `cortex-auto-update.timer` | Daily at 03:00 UTC | Runs `apt`, `brew`, `npm`, `pip`, `snap`, and `docker compose pull/up` across all stacks. Requires a backup younger than 24 h as preflight. Smart-restarts affected services after binary changes. |
| `cortex-9router-health.timer` | Every 2 minutes | Active probe: checks `/v1/models` HTTP 200, then fires a real chat-completion through the cheapest local model. Restarts `9router.service` on any failure. |
| `cortex-degraded-service-watcher.timer` | Every 5 minutes | Queries the dashboard DB for active services, health-checks each one (systemd / docker / process / http), collects `systemctl status` + `journalctl` evidence, asks 9Router AI for safe repair actions, then `reset-failed` + `restart`s degraded units. |
| `cortex-backup.timer` | 00:00 and 12:00 UTC | Full logical backup: PostgreSQL, MongoDB, MySQL, Redis, Hermes, Ollama models, secrets, SOPS templates, systemd units, UFW rules, all compose stacks, Grafana, Prometheus, Loki. Encrypts with `age` to `/mnt/hdd/backups/`. Prunes snapshots older than 7 days / beyond 14 kept. |

## Prerequisites

- [ ] `31-9router.md` completed — 9Router running and `9router.env` present.
- [ ] `70-dashboard.md` completed — dashboard DB reachable (`dashboard.env` present).
- [ ] `/mnt/hdd` is a mounted writable volume (required by backup and auto-update preflight).
- [ ] `age`, `gzip`, `node`, `jq` installed on the host.

Verify tools are present:

```bash
for bin in age gzip node jq; do
  command -v "$bin" && echo "$bin ok" || echo "MISSING: $bin"
done
```

If `age` is missing, install it via `scripts/pkg.sh`:

```bash
source scripts/pkg.sh
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
pkg_install age
```

## CHECKPOINT 1

**STOP — operator questions:**

1. Is `/mnt/hdd` mounted and writable?

   ```bash
   mountpoint /mnt/hdd && df -h /mnt/hdd
   ```

2. Is `9router.env` present at `/opt/cortexos/.secrets/9router.env`?

   ```bash
   test -f /opt/cortexos/.secrets/9router.env && echo present || echo MISSING
   ```

3. Is `dashboard.env` present at `/opt/cortexos/.secrets/dashboard.env`?

   ```bash
   test -f /opt/cortexos/.secrets/dashboard.env && echo present || echo MISSING
   ```

Type `confirmed` to proceed only after all three checks pass.

## Step 1 — Copy scripts

```bash
mkdir -p /opt/cortexos/scripts/ops
cp /opt/cortexos/scripts/ops/cortex-9router-healthcheck.sh \
   /opt/cortexos/scripts/ops/cortex-auto-update.sh \
   /opt/cortexos/scripts/ops/cortex-backup.sh \
   /opt/cortexos/scripts/ops/cortex-degraded-service-watcher.mjs \
   /opt/cortexos/scripts/ops/
chmod +x /opt/cortexos/scripts/ops/cortex-9router-healthcheck.sh \
         /opt/cortexos/scripts/ops/cortex-auto-update.sh \
         /opt/cortexos/scripts/ops/cortex-backup.sh
```

> `cortex-degraded-service-watcher.mjs` is executed directly by node; no
> `chmod +x` required unless you want to run it as a standalone command.

## Step 2 — Install systemd units

Copy all eight unit files from the repo templates:

```bash
cp /opt/cortexos/templates/systemd/cortex-9router-health.service \
   /opt/cortexos/templates/systemd/cortex-9router-health.timer \
   /opt/cortexos/templates/systemd/cortex-auto-update.service \
   /opt/cortexos/templates/systemd/cortex-auto-update.timer \
   /opt/cortexos/templates/systemd/cortex-degraded-service-watcher.service \
   /opt/cortexos/templates/systemd/cortex-degraded-service-watcher.timer \
   /opt/cortexos/templates/systemd/cortex-backup.service \
   /opt/cortexos/templates/systemd/cortex-backup.timer \
   /etc/systemd/system/

systemctl daemon-reload
```

## Step 3 — Configure the backup secret

The backup script requires an `age` recipient public key stored in
`/opt/cortexos/.secrets/backup.env`.

**STOP — operator action required.**

Generate or locate your age recipient public key. If you do not have one:

```bash
age-keygen -o /opt/cortexos/.secrets/backup-identity.txt
# The public key is printed to stdout — copy it.
```

Write the env file with your actual public key:

```bash
# Replace age1... with your real recipient public key.
cat > /opt/cortexos/.secrets/backup.env <<'EOF'
AGE_PUBKEY=age1...
EOF
chmod 600 /opt/cortexos/.secrets/backup.env
```

Confirm the file is correct:

```bash
grep AGE_PUBKEY /opt/cortexos/.secrets/backup.env
```

## CHECKPOINT 2

**STOP — operator question:** Does the following dry-run exit 0 with no errors?

```bash
CORTEX_ROOT=/opt/cortexos bash /opt/cortexos/scripts/ops/cortex-backup.sh --dry-run
```

Expected: `[dry-run]` lines printed, no `missing backup env` or `AGE_PUBKEY unset` errors.

Type `confirmed` to proceed.

## Step 4 — Enable and start timers

```bash
systemctl enable --now \
  cortex-9router-health.timer \
  cortex-auto-update.timer \
  cortex-degraded-service-watcher.timer \
  cortex-backup.timer
```

## Verify

List active timers and confirm all four appear:

```bash
systemctl list-timers 'cortex-*' --no-pager
```

Check that each oneshot service can be triggered manually without error:

```bash
# 9Router health probe (safe — only restarts 9router if unhealthy):
systemctl start cortex-9router-health.service
journalctl -u cortex-9router-health.service -n 20 --no-pager

# Degraded-service watcher dry run:
CORTEX_DEGRADED_WATCHER_DRY_RUN=1 \
  node /opt/cortexos/scripts/ops/cortex-degraded-service-watcher.mjs

# Auto-update dry run:
bash /opt/cortexos/scripts/ops/cortex-auto-update.sh --dry-run

# Backup dry run:
bash /opt/cortexos/scripts/ops/cortex-backup.sh --dry-run
```

Check recent journal output for any unit:

```bash
journalctl -u cortex-backup.service -n 40 --no-pager
journalctl -u cortex-degraded-service-watcher.service -n 40 --no-pager
```

## Rollback

To disable all ops timers without removing the unit files:

```bash
systemctl disable --now \
  cortex-9router-health.timer \
  cortex-auto-update.timer \
  cortex-degraded-service-watcher.timer \
  cortex-backup.timer
```

To remove the units entirely:

```bash
rm /etc/systemd/system/cortex-9router-health.{service,timer} \
   /etc/systemd/system/cortex-auto-update.{service,timer} \
   /etc/systemd/system/cortex-degraded-service-watcher.{service,timer} \
   /etc/systemd/system/cortex-backup.{service,timer}
systemctl daemon-reload
```

## Next

→ `prompts/tools/99-final-validation.md`
