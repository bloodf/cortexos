# Credentials

Runtime credentials live under `/opt/cortexos/.secrets/` with mode `0600`.

Current agent stack credentials:

- `dashboard.env`
- `9router.env`
- `honcho.env`
- `hermes/primary.env`
- `hermes/secondary.env`
- `paperclip.env`
- `langfuse.env`

Retired agent-stack credentials are import material only and must
not be used by live services.
