# Services

Active CortexOS services after the Hermes/Honcho cutover.

| Service | Spoke | Loopback | Public access | Secret |
| --- | --- | --- | --- | --- |
| 9Router | `31-9router.md` | `localhost:11434` | `https://${CORTEX_DOMAIN}:11434/dashboard` | `/opt/cortexos/.secrets/9router.env` |
| Honcho API | `32-honcho.md` | `localhost:18690` | health/services only | `/opt/cortexos/.secrets/honcho.env` |
| Ollama | `32-honcho.md` | `localhost:11435` | none | systemd `ollama.service` |
| Ollama Honcho Embeddings Proxy | `32-honcho.md` | `172.30.0.1:11435` | none | systemd `ollama-honcho-embeddings-proxy.service` |
| Hermes Primary API | `41-hermes-profiles.md` | `localhost:18691` | health/services only | `/opt/cortexos/.secrets/hermes/primary.env` |
| Hermes Secondary API | `41-hermes-profiles.md` | `localhost:18692` | health/services only | `/opt/cortexos/.secrets/hermes/secondary.env` |
| Hermes Web UI | `40-hermes.md` | `localhost:9119` | `https://${CORTEX_DOMAIN}:9119/` | none |
| Paperclip | `62-paperclip.md` | project configured | Paperclip managed | `/opt/cortexos/.secrets/paperclip.env` |
| Dashboard | `70-dashboard.md` | `localhost:3080` | `https://${CORTEX_DOMAIN}/` | `/opt/cortexos/.secrets/dashboard.env` |

Paperclip and Hermes are the only agent orchestration path. Honcho is the only
memory backend. Honcho uses Ollama for local embeddings and 9Router for all
tool-calling reasoning features. Retired custom agent workflow services are
removed from the active service catalog.

Dashboard Apps lists browser UIs only. API-only, metrics-only, health-only, and process-only services remain visible in Services/Healthcheck, not Apps.
