# Secrets

SOPS templates decrypt into `/opt/cortexos/.secrets/`. Required active agent
secrets are:

- `honcho.env`
- `hermes/<profile>.env`
- `paperclip.env`
- `dashboard.env`
- `9router.env`

Remove retired service env files during the cutover. They are not recovery
inputs.
