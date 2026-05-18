# OpenClaw Account Ops (latest)

## Purpose

Set up backup and restore procedures for your personal OpenClaw account using the generic account-slug-parameterized scripts in `templates/scripts/`. This spoke is generic — run it once per account you wish to protect.

## Prerequisites

- `40-openclaw.md` completed.
- `templates/scripts/backup-openclaw-account.sh` and `templates/scripts/restore-openclaw-account.sh` present.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## CHECKPOINT 1

Operator: decide which OpenClaw account slug you want to back up (e.g. the account name shown in `~/.openclaw/openclaw.json` → `"account"` field). Have the slug ready. Type "confirmed" to proceed.

## Configure

```bash
# Dry-run backup to verify paths are correct
bash templates/scripts/backup-openclaw-account.sh <your-account-slug> --dry-run
```

If the dry-run prints the expected file list without errors, run the actual backup:

```bash
bash templates/scripts/backup-openclaw-account.sh <your-account-slug>
```

The script writes a timestamped archive to `/opt/cortexos/.secrets/backups/openclaw-<your-account-slug>-<timestamp>.tar.gz`.

## Restore procedure

To restore from a backup:

```bash
bash templates/scripts/restore-openclaw-account.sh <your-account-slug> \
  /opt/cortexos/.secrets/backups/openclaw-<your-account-slug>-<timestamp>.tar.gz
```

The restore script stops OpenClaw, applies the archive, then restarts OpenClaw.

## Automate (optional)

To run backup daily via cron:

```bash
(crontab -l 2>/dev/null; echo "0 2 * * * bash /opt/cortexos/templates/scripts/backup-openclaw-account.sh <your-account-slug> >> /var/log/openclaw-backup.log 2>&1") | crontab -
```

## Verify

```bash
ls -lh /opt/cortexos/.secrets/backups/
```

Expected: at least one `.tar.gz` archive for your account slug.

## CHECKPOINT 2

Operator: confirm the backup archive exists and the restore script dry-run completes without errors. Type "confirmed" to proceed.

## Next

→ `prompts/tools/50-agentgateway.md`
