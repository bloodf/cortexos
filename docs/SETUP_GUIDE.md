# Setup Guide

Use the rebuild scripts:

```bash
scripts/rebuild/inventory.sh --output <dir>
scripts/rebuild/validate.sh --local
scripts/rebuild/backup.sh --dry-run
scripts/rebuild/restore.sh --verify-remote <backup-dir>
```

Only run apply phases after the backup/restore gate in `PLAN.md` is green.
