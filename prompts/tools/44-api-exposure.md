# Hermes and Honcho API Exposure

## Purpose

Expose Hermes profile APIs and Honcho to the operator's local machine through
Tailscale/Caddy with defense-in-depth auth.

## Routes

| Public path | Loopback target |
| --- | --- |
| `/honcho/*` | `http://127.0.0.1:18690/*` |
| `/hermes/primary/v1/*` | `http://127.0.0.1:18691/v1/*` |
| `/hermes/secondary/v1/*` | `http://127.0.0.1:18692/v1/*` |

Use both Tailscale ACL restrictions and Caddy bearer authentication. Each
Hermes profile uses its own API key.

Update the Caddy/Tailscale route source used by `13-tailscale-serve.md` with
these path handlers and reload Caddy/Tailscale Serve. Do not expose these ports
on the public internet or bind Hermes/Honcho to `0.0.0.0`.

The Hermes endpoints are CortexOS profile APIs around the local Hermes CLI:
`/health`, `/v1/models`, and `/v1/chat/completions`. They are for operator
access and dashboard checks, not Paperclip scheduling.

## Verify

```bash
curl -fsS -H "Authorization: Bearer ${HERMES_PRIMARY_API_KEY}" \
  "https://${CORTEX_DOMAIN}/hermes/primary/v1/models"

curl -fsS -H "Authorization: Bearer ${HERMES_SECONDARY_API_KEY}" \
  "https://${CORTEX_DOMAIN}/hermes/secondary/v1/models"

curl -fsS -H "Authorization: Bearer ${HONCHO_API_KEY}" \
  "https://${CORTEX_DOMAIN}/honcho/health"
```

Unauthenticated requests must return 401 or 403.

## Next

→ `prompts/tools/49-memory-import-prep.md`
