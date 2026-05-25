# Secrets Rotation

| Secret | Location | Service |
| --- | --- | --- |
| 9Router API key | `/opt/cortexos/.secrets/9router.env` | 9Router, Hermes, Honcho |
| Honcho env | `/opt/cortexos/.secrets/honcho.env` | Honcho |
| Hermes profile key | `/opt/cortexos/.secrets/hermes/<profile>.env` | One Hermes profile |
| Paperclip API key | `/opt/cortexos/.secrets/paperclip.env` | Paperclip |
| Dashboard env | `/opt/cortexos/.secrets/dashboard.env` | Dashboard |

Rotate profile keys independently. After rotating a Hermes profile key, restart
that profile's API service and update the matching Caddy bearer secret.
