# Services

Active CortexOS services after the Hermes/Honcho cutover.

| Service | Spoke | Loopback | Public access | Secret |
| --- | --- | --- | --- | --- |
| 9Router | `31-9router.md` | `127.0.0.1:11434` | `https://${CORTEX_DOMAIN}:11434/dashboard` | `/opt/cortexos/.secrets/9router.env` |
| Honcho | `32-honcho.md` | `127.0.0.1:18690` | `https://${CORTEX_DOMAIN}:18690/` | `/opt/cortexos/.secrets/honcho.env` |
| Ollama | `32-honcho.md` | `127.0.0.1:11435` | none | systemd `ollama.service` |
| Ollama Honcho Embeddings Proxy | `32-honcho.md` | `172.30.0.1:11435` | none | systemd `ollama-honcho-embeddings-proxy.service` |
| Hermes Primary | `41-hermes-profiles.md` | `127.0.0.1:18691` | `https://${CORTEX_DOMAIN}:18691/v1/` | `/opt/cortexos/.secrets/hermes/primary.env` |
| Hermes Secondary | `41-hermes-profiles.md` | `127.0.0.1:18692` | `https://${CORTEX_DOMAIN}:18692/v1/` | `/opt/cortexos/.secrets/hermes/secondary.env` |
| Paperclip | `62-paperclip.md` | project configured | Paperclip managed | `/opt/cortexos/.secrets/paperclip.env` |
| Dashboard | `70-dashboard.md` | `127.0.0.1:3080` | `https://${CORTEX_DOMAIN}/` | `/opt/cortexos/.secrets/dashboard.env` |

Paperclip and Hermes are the only agent orchestration path. Honcho is the only
memory backend. Honcho uses Ollama for local embeddings and 9Router for all
tool-calling reasoning features. Retired custom agent workflow services are
removed from the active service catalog.
