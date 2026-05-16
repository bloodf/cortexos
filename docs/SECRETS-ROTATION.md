# CortexOS Secrets Rotation

> Rotation procedures for HMAC keys, API keys, NATS NKeys, dashboard secrets, and project bot credentials.

## Contents

- [Rotation matrix](#rotation-matrix)
- [Standard procedure](#standard-procedure)
- [Verification](#verification)
- [Rollback](#rollback)
- [Related docs](#related-docs)

## Rotation matrix

| Secret | Env name | Source | Restart |
|---|---|---|---|
| OpenClaw outbound HMAC | `CORTEX_OPENCLAW_OUTBOUND_HMAC` | `/opt/cortexos/.secrets/consumer.env` | `cortex-consumer` |
| NATS approval HMAC | `CORTEX_NATS_HMAC` | `/opt/cortexos/.secrets/consumer.env` | `cortex-consumer` |
| Confirmation HMAC | `CORTEX_CONFIRMATION_HMAC_SECRET` | `/opt/cortexos/.secrets/dashboard.env` | dashboard |
| 9Router API key | `NINEROUTER_API_KEY` | `/opt/cortexos/.secrets/9router.env` | dashboard |
| NATS NKey seeds | seed variables | `/opt/cortexos/.secrets/nats-nkeys.env` | NATS and consumers |

## Standard procedure

1. Announce maintenance window when user-facing service may restart.
2. Generate replacement secret with approved tool.
3. Update source env file.
4. Restart affected service.
5. Verify health and dependent flow.
6. Re-export credentials and update dashboard encrypted copy.
7. Record rotation date and owner.

## Verification

```bash
sudo systemctl status cortex-consumer
sudo systemctl status cortex-dashboard
curl -fsS http://localhost:7080/healthz
curl -fsS http://localhost:3080/api/health
```

## Rollback

Rollback only when old secret remains valid and uncompromised. If rotation responds to suspected compromise, do not restore old secret; fix consumers instead.

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
