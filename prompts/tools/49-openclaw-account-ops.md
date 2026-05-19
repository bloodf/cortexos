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

## Todo

- [ ] CHECKPOINT 1 confirmed — account slug identified
- [ ] Run dry-run backup with chosen slug
- [ ] Run actual backup; confirm `.tar.gz` archive written under `/opt/cortexos/.secrets/backups/`
- [ ] Review restore command + dry-run option
- [ ] (Optional) Install daily backup cron entry
- [ ] CHECKPOINT 2 confirmed — archive present
- [ ] CHECKPOINT 2b confirmed — restore dry-run succeeds

## CHECKPOINT 1

**STOP — operator question:** Does `jq -r .account ~/.openclaw/openclaw.json` print a non-empty account slug (not `null`, not `parse error`)?

Type `confirmed` to proceed.

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

**STOP — operator question:** Does `ls /opt/cortexos/.secrets/backups/openclaw-<slug>-*.tar.gz 2>/dev/null | wc -l` print a number ≥ 1 (not `0`)?

Type `confirmed` to proceed.

## CHECKPOINT 2b

**STOP — operator question:** Does `bash templates/scripts/restore-openclaw-account.sh <slug> <archive> --dry-run` exit 0 with no `error:` lines (not `archive not found`, not `permission denied`)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/50-agentgateway.md`
