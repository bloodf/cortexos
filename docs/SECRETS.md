# Secrets

Secrets remain host-owned env files. The repository tracks only:

- `manifests/rebuild/secrets.manifest.tsv`
- validation rules in `scripts/rebuild/validate.sh`
- backup scope in `manifests/rebuild/backup-scope.tsv`

Do not commit decrypted secret values or generated env files.
