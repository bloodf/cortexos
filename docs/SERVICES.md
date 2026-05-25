# Services

Active CortexOS services. Public access is derived from `CORTEX_DOMAIN` during
install; migrations must not hardcode a machine-specific hostname.

| Service | Prompt | Local endpoint | Secret source |
| --- | --- | --- | --- |
| 9Router | `31-9router.md` | `127.0.0.1:11434` | `/opt/cortexos/.secrets/9router.env` |
| Honcho | `32-honcho.md` | `127.0.0.1:18690` | `/opt/cortexos/.secrets/honcho.env` |
| Ollama embeddings | `32-honcho.md` | `127.0.0.1:11435` | systemd service env |
| Hermes profile API | `41-hermes-profiles.md` | `127.0.0.1:18691+` | `/opt/cortexos/.secrets/hermes/<profile>.env` |
| Paperclip proxy | `62-paperclip.md` | `127.0.0.1:3033` | `/opt/cortexos/.secrets/paperclip.env` |
| Paperclip upstream | `62-paperclip.md` | `127.0.0.1:3034` | `/opt/cortexos/.secrets/paperclip.env` |
| Dashboard | `70-dashboard.md` | `127.0.0.1:3080` | `/opt/cortexos/.secrets/dashboard.env` |
| Hermes Web UI | `40-hermes.md` | `127.0.0.1:9119` | Hermes profile env |
| Webmin | `26b-webmin.md` | `127.0.0.1:10000` | Linux system accounts |

Paperclip and Hermes are the only agent execution path. Honcho is the memory
backend. 9Router is the model gateway. Ollama is local embeddings only.
