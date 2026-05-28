# 31 - 9Router

9Router stays on the host as the shared AI routing service.

Requirements:

- Env file: `/opt/cortexos/.secrets/9router.env`.
- Health: `GET http://127.0.0.1:11434/v1/models`.
- Project instances receive only the model access they need.

Record health and model-list evidence in `PLAN.md`.
