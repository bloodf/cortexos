# CortexOS Troubleshooting

> Search-friendly catalog of common failures, diagnostics, and remediation steps.

## Contents

- [Method](#method)
- [Infrastructure](#infrastructure)
- [Dashboard](#dashboard)
- [NATS and consumer](#nats-and-consumer)
- [Agents](#agents)
- [Credentials](#credentials)
- [Related docs](#related-docs)

## Method

1. Identify failing layer.
2. Check service health.
3. Inspect recent logs.
4. Verify env file and secret source.
5. Restart smallest affected service.
6. Record root cause in runbook if novel.

## Infrastructure

| Symptom | Check | Fix |
|---|---|---|
| Docker stack unhealthy | `docker compose ps` | Inspect logs, env, ports |
| Redis auth mismatch | `/opt/cortexos/init-scripts/redis.conf` | Align container env and restart |
| Port conflict | `ss -tulpn` | Move service or stop host daemon |
| Caddy route fails | Caddy logs and DNS | Verify upstream and TLS config |

## Dashboard

| Symptom | Likely cause | Fix |
|---|---|---|
| Login fails | Bad session secret or DB connection | Check `/opt/cortexos/.secrets/dashboard.env` |
| Build fails | Next.js or TypeScript error | Run dashboard tests locally |
| Env read denied | Path outside allowlist | Use documented roots only |
| Health tile stale | Seed mismatch or service down | Check migrations and service endpoint |

## NATS and consumer

- Confirm NATS monitor endpoint on `:8222`.
- Confirm subjects match [NATS contract](NATS-CONTRACT.md).
- Check `cortex-consumer` systemd logs.
- Validate HMAC variables when approvals fail.

## Agents

- Verify OpenClaw gateway health on port `18789`.
- Confirm role file exists in deployed templates.
- Check Slack token and channel/thread IDs.
- Re-dispatch only after previous session terminal state is known.

## Credentials

- Masked view working but reveal failing usually means confirmation token or admin session problem.
- Decryption failure usually means wrong `CORTEX_MASTER_KEY` or corrupted row.
- Rotation must update source file and dashboard copy.

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
