# 99 - Final Validation

Final validation follows `PLAN.md`.

Minimum checks:

```bash
scripts/rebuild/validate.sh --local
scripts/rebuild/restore.sh --verify-remote <backup-dir>
curl -fsS http://127.0.0.1:18800/health
curl -fsS http://127.0.0.1:3080/en/login
```

Also validate host services, protected Hermes profiles, Incus instances,
project builds, dashboard helper audit rows, monitoring, and backup metadata.
