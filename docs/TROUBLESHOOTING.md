# Troubleshooting

Start with:

```bash
scripts/rebuild/validate.sh --local
scripts/rebuild/plan.sh
```

For live host issues, check the latest backup metadata under
`/mnt/hdd/cortexos-backups`, systemd status, dashboard helper audit logs, and
the phase notes in `PLAN.md`.
