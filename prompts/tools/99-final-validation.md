# Final Validation

## Purpose

Validate the Paperclip + Hermes + Honcho CortexOS stack.

## Checks

- 9Router exposes the configured Hermes chat models.
- Honcho is healthy on `127.0.0.1:18690`.
- Ollama is healthy on `127.0.0.1:11435` and returns 768-dimensional
  `nomic-embed-text:latest` embeddings.
- Honcho containers can reach Ollama through
  `172.30.0.1:11435` and 9Router through `172.17.0.1:11434`.
- Honcho deriver is running; deriver, summary, dialectic, and dream all route
  through 9Router, while embeddings route through Ollama.
- Hermes Primary is healthy on `127.0.0.1:18691`.
- Hermes Secondary is healthy on `127.0.0.1:18692`.
- Paperclip can execute a Hermes run for each profile.
- Dashboard service catalog contains Hermes/Honcho/Paperclip and no active
  retired agent-workflow services.
- Local-machine API access works through Caddy/Tailscale with auth and fails
  without auth.

## Commands

```bash
set -a
source /opt/cortexos/.secrets/9router.env
set +a

curl -fsS -H "Authorization: Bearer ${NINEROUTER_API_KEY}" \
  "${NINEROUTER_BASE_URL%/}/v1/models" | jq -e '.data[].id | select(.=="cx/gpt-5.5")'

curl -fsS http://127.0.0.1:18690/health
curl -fsS http://127.0.0.1:18691/health
curl -fsS http://127.0.0.1:18692/health

CORTEX_FULL_PIPELINE_SMOKE=1 bash scripts/cortex-production-readiness.sh
```

## Repository Gate

Active installer prompts, templates, dashboard code, and scripts must describe
only the Paperclip, Hermes, Honcho, Ollama, and 9Router runtime.
