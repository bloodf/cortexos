# Backup and Auto-Update

## Backup

`cortex-backup.timer` runs `cortex-backup.service` every 12 hours:

```bash
systemctl enable --now cortex-backup.timer
systemctl start cortex-backup.service
journalctl -u cortex-backup.service
```

Backups are assembled under `/mnt/hdd/backups/YYYY-MM-DD_HHMM/`, tarred, then encrypted to:

```text
/mnt/hdd/backups/YYYY-MM-DD_HHMM.tar.gz.age
```

Retention keeps 7 days / newest 14 encrypted snapshots. No `latest` symlink is maintained; use newest mtime.

Covered data:

- PostgreSQL, Honcho PostgreSQL, MongoDB, MySQL logical dumps
- Redis RDB snapshots
- Langfuse ClickHouse SQL/native dumps
- Hermes, Paperclip, Ollama model data
- CortexOS secrets, SOPS templates, selected systemd units, UFW rules
- Docker compose stacks, Honcho compose, monitoring configs/provisioning

Encryption uses:

- recipient: `AGE_PUBKEY` from `/opt/cortexos/.secrets/backup.env`
- identity: `/opt/cortexos/.secrets/backup-identity.txt`

Restore flow:

```bash
age -d -i /opt/cortexos/.secrets/backup-identity.txt \
  /mnt/hdd/backups/YYYY-MM-DD_HHMM.tar.gz.age > /tmp/cortex-backup.tar.gz
mkdir -p /tmp/cortex-restore
tar -C /tmp/cortex-restore -xzf /tmp/cortex-backup.tar.gz
```

Inspect `/tmp/cortex-restore/YYYY-MM-DD_HHMM/manifest.json` before restoring files or DB dumps.

Dry run / prune:

```bash
/opt/cortexos/scripts/cortex-backup.sh --dry-run
/opt/cortexos/scripts/cortex-backup.sh --prune-only
```

## Auto-update

`cortex-auto-update.timer` runs daily at 03:00 UTC, before Watchtower's 04:00 sweep:

```bash
systemctl enable --now cortex-auto-update.timer
systemctl start cortex-auto-update.service
journalctl -u cortex-auto-update.service
```

Pre-flight refuses to run unless `/mnt/hdd` is mounted and the newest encrypted backup in `/mnt/hdd/backups/` is newer than 24 hours.

Update scope:

- `apt-get update && apt-get upgrade -y`
- Homebrew update/upgrade when Linuxbrew exists
- `npm update -g`
- pip package upgrades for `/opt/cortexos/stacks/*/.venv/`
- `snap refresh`
- `docker compose pull && docker compose up -d --remove-orphans` for `/opt/cortexos/stacks/*/docker-compose.yml`

Smart restarts compare binary checksums before/after updates:

- `9router` → `9router.service`, `9router-docker-proxy.service`
- `node` → `cortex-dashboard.service`, running `hermes-profile@*.service`, `paperclip.service`
- `ollama` → `ollama.service`, `ollama-honcho-embeddings-proxy.service`
- Linuxbrew binary changes → CortexOS native app services

Logs:

```text
/opt/cortexos/logs/auto-update-*.log
/opt/cortexos/logs/auto-update-*.json
```

Exit codes: `0` clean, `1` partial manager failure, `2` pre-flight failure.

Dry run:

```bash
/opt/cortexos/scripts/cortex-auto-update.sh --dry-run
```
