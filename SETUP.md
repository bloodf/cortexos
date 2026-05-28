# Setup

The old spoke setup flow has been replaced by the rebuild flow.

Start with:

```bash
scripts/rebuild/validate.sh --local
scripts/rebuild/plan.sh
```

Then follow the phase gates in `PLAN.md`. Backups and restore verification must
complete before any destructive host cleanup.
