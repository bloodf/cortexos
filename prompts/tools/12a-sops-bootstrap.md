# 12a - Secrets Bootstrap

Secrets are now host-owned env files. The repo tracks only manifests and
validation rules.

Canonical files:

- `manifests/rebuild/secrets.manifest.tsv`
- `manifests/rebuild/backup-scope.tsv`
- `docs/SECRETS.md`

Validation:

```bash
scripts/rebuild/validate.sh --local
```
