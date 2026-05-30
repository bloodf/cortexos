# 00 - Rebuild Preflight

Use the rebuild flow, not the old spoke installer.

Required checks:

```bash
scripts/rebuild/inventory.sh --output /tmp/cortexos-inventory
scripts/rebuild/validate.sh --local
scripts/rebuild/plan.sh
```

Do not start destructive work until the backup and restore gate in `PLAN.md`
is green.
