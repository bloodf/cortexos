# Canonical Endpoints

Single source of truth for all VPS internal endpoints used by agent-factory files.
Do not duplicate these URLs in other docs — reference this file by relative path.

## 9Router

- Base:        `http://127.0.0.1:11434/v1`
- Chat:        `http://127.0.0.1:11434/v1/chat/completions`
- Models list: `http://127.0.0.1:11434/v1/models`

## Paperclip

- Base:        `http://127.0.0.1:3033`
- Health:      `http://127.0.0.1:3033/api/health`

## Honcho

- Base:        `http://127.0.0.1:{Honcho_port}` (default `18690`)

## Hermes

- Primary:     `http://127.0.0.1:18691/v1`
- Secondary:   `http://127.0.0.1:18692/v1`

## Notes

- All endpoints bind to `127.0.0.1`. Public access flows through Caddy reverse proxy
  on the `caddy.service` systemd unit (do not reference the stale
  `caddy-openclaw.service` name).
- Agents MUST call `9router` directly at `127.0.0.1:11434`. No direct provider calls.
