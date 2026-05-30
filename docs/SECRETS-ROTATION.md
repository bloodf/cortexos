# Secrets Rotation

Rotation procedures are rebuilt around `manifests/rebuild/secrets.manifest.tsv`.

For each secret:

1. Identify owner and service placement.
2. Rotate in the external system.
3. Update the host-owned env file.
4. Restart only the dependent service.
5. Record validation evidence in `PLAN.md`.
