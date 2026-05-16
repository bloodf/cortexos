# Canonical Endpoints

Single source of truth for all VPS internal endpoints used by agent-factory files.
Do not duplicate these URLs in other docs — reference this file by relative path.

## 9Router

- Base:        `http://127.0.0.1:20128/v1`
- Chat:        `http://127.0.0.1:20128/v1/chat/completions`
- Models list: `http://127.0.0.1:20128/v1/models`

## OpenViking

- Base: `http://127.0.0.1:{openviking_port}` (default `1933`)

## Hindsight

- Base: `http://127.0.0.1:{hindsight_port}` (default `1953`)

## AgentGateway

- MCP bind:  `http://127.0.0.1:4100`
- LLM proxy: `http://127.0.0.1:4101`

## Notes

- All endpoints bind to `127.0.0.1`. Public access flows through Caddy reverse proxy
  on the `caddy.service` systemd unit (do not reference the stale
  `caddy-openclaw.service` name).
- Agents MUST call `9router` directly at `127.0.0.1:20128`. No direct provider calls.
