# OpenClaw Account Ops (latest)

## Purpose

Set up backup and restore procedures for an OpenClaw account/agent slug using
the generic scripts in `templates/scripts/`.

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

- [ ] CHECKPOINT 1 confirmed
- [ ] Configure
- [ ] Restore procedure
- [ ] Automate (optional)
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Decide which OpenClaw account/agent slug you want to back up.

Type `confirmed` to proceed.

## Configure

Dry-run backup first:

```bash
bash templates/scripts/backup-openclaw-account.sh <your-account-slug> --dry-run
```

If the dry-run prints the expected file list without errors, run the actual backup:

```bash
bash templates/scripts/backup-openclaw-account.sh <your-account-slug>
```

The script writes a timestamped archive to `/opt/cortexos/.secrets/backups/openclaw-<your-account-slug>-<timestamp>.tar.gz` and, when `AGE_PUBKEY` is configured, an encrypted companion archive `...tar.gz.age`.
Current OpenClaw releases no longer expose `openclaw account export`; the script therefore snapshots the on-disk state (`~/.openclaw/openclaw.json`, the matching `~/.openclaw/agents/<slug>` directory when present, and `~/.openclaw/workspace`) plus a sha256 manifest.

## Restore procedure

```bash
bash templates/scripts/restore-openclaw-account.sh <your-account-slug> \
  /opt/cortexos/.secrets/backups/openclaw-<your-account-slug>-<timestamp>.tar.gz
# or, if encrypted:
# bash templates/scripts/restore-openclaw-account.sh <your-account-slug> \
#   /opt/cortexos/.secrets/backups/openclaw-<your-account-slug>-<timestamp>.tar.gz.age
```

The restore script validates the manifest, stops `openclaw-gateway` when present, restores the on-disk snapshot atomically, then starts `openclaw-gateway` again.

## Automate (optional)

```bash
(crontab -l 2>/dev/null; echo "0 2 * * * bash /opt/cortexos/templates/scripts/backup-openclaw-account.sh <your-account-slug> >> /var/log/openclaw-backup.log 2>&1") | crontab -
```

## Verify

```bash
ls -lh /opt/cortexos/.secrets/backups/
```

Expected: at least one `.tar.gz` archive for your account slug (and optionally a `.tar.gz.age` companion).

## CHECKPOINT 2

**STOP — operator question:** The backup archive exists and the restore script validation completes without errors?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/50-agentgateway.md`
